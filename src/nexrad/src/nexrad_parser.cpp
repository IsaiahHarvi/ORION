#include <bzlib.h>
#include <vector>
#include <stdexcept>
#include <cstdint>
#include <string>
#include <iostream>
#include "nexrad_parser.hpp"

namespace
{
    int find_wmo_start(const std::vector<uint8_t> &data)
    {
        int newlines = 0;
        for (size_t i = 0; i < data.size(); ++i)
        {
            if (data[i] == '\n' || data[i] == '\r')
            {
                newlines++;
                if (newlines == 6)
                    return static_cast<int>(i + 1);
            }
        }
        throw std::runtime_error("Couldn't find start after WMO header");
    }

    uint16_t read_u16_be(const std::vector<uint8_t> &data, size_t offset)
    {
        return static_cast<uint16_t>((data[offset] << 8) | data[offset + 1]);
    }
}

namespace NEXRAD
{
    std::vector<uint8_t> Parser::decompress_bzip2(const std::vector<uint8_t> &raw)
    {
        int wmo_offset = find_wmo_start(raw);
        size_t p10_offset = wmo_offset + 120 + 18;

        if (p10_offset + 2 > raw.size())
            throw std::runtime_error("File too short to read P10 uncompressed size");

        uint16_t p10_halfwords = read_u16_be(raw, p10_offset);
        unsigned int estimated_uncompressed_size = p10_halfwords * 2;
        unsigned int destLen = estimated_uncompressed_size + 2048;

        size_t offset = 0;
        for (size_t i = 0; i < raw.size() - 2; i++)
        {
            if (raw[i] == 0x42 && raw[i + 1] == 0x5A && raw[i + 2] == 0x68)
            {
                offset = i;
                break;
            }
        }

        if (offset == 0)
            throw std::runtime_error("Could not find bzip2 header in file");

        const char *compressed = reinterpret_cast<const char *>(&raw[offset]);
        unsigned int sourceLen = raw.size() - offset;

        std::vector<uint8_t> decompressed(destLen);
        int result = BZ2_bzBuffToBuffDecompress(
            reinterpret_cast<char *>(decompressed.data()),
            &destLen,
            const_cast<char *>(compressed),
            sourceLen,
            0, 0);

        if (result == BZ_OUTBUFF_FULL)
        {
            destLen = estimated_uncompressed_size * 2;
            decompressed.resize(destLen);
            result = BZ2_bzBuffToBuffDecompress(
                reinterpret_cast<char *>(decompressed.data()),
                &destLen,
                const_cast<char *>(compressed),
                sourceLen,
                0, 0);
        }

        if (result != BZ_OK)
            throw std::runtime_error("BZ2_bzBuffToBuffDecompress failed with code " + std::to_string(result));

        decompressed.resize(destLen);
        return decompressed;
    }

    RadarSweep Parser::parse_packet_16(const std::vector<uint8_t> &data)
    {
        float base_dbz = -32.0f;
        float step = 0.5f;
        RadarSweep sweep;
        size_t offset = 0;

        auto read_u16 = [&](size_t i) -> uint16_t
        {
            if (i + 1 >= data.size())
                throw std::runtime_error("Attempt to read past end of data in read_u16");
            return static_cast<uint16_t>((data[i] << 8) | data[i + 1]);
        };

        while (offset + 2 <= data.size())
        {
            uint16_t code = read_u16(offset);
            if (code == 16)
                break;
            offset += 2;
        }

        if (offset + 14 > data.size())
            throw std::runtime_error("Packet 16 header truncated or not found.");

        offset += 2;

        uint16_t first_bin = read_u16(offset);
        offset += 2;
        uint16_t bin_count = read_u16(offset);
        offset += 2;
        uint16_t i_center = read_u16(offset);
        offset += 2;
        uint16_t j_center = read_u16(offset);
        offset += 2;
        float scale = read_u16(offset) / 1000.0f;
        offset += 2;

        sweep.first_bin = first_bin;
        sweep.bin_size_meters = scale * 1000.0f;

        uint16_t radial_count = read_u16(offset);
        offset += 2;

        for (int r = 0; r < radial_count; r++)
        {
            if (offset + 6 > data.size())
                break;

            uint16_t byte_count = read_u16(offset);
            offset += 2;
            float rstart = read_u16(offset) / 10.0f;
            offset += 2;
            float rdelta = read_u16(offset) / 10.0f;
            offset += 2;

            if (offset + byte_count > data.size())
                break;

            RadarRadial radial;
            radial.angle = rstart;

            for (int i = 0; i < byte_count; i++)
            {
                uint8_t raw_val = data[offset++];
                if (raw_val < 2)
                    continue;

                float dbz = base_dbz + (raw_val * step);
                if (dbz < 0.0f)
                    continue;

                RadarBin bin;
                bin.value = dbz;
                radial.bins.push_back(bin);
            }

            sweep.radials.push_back(radial);
        }

        return sweep;
    }
}
