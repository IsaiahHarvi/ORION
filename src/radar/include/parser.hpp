#pragma once
#include <vector>
#include <cstdint>

namespace parser {
    struct RadarBin {
        float value; // e.g., dBZ or reflectivity
    };
    
    struct RadarRadial {
        float angle; // in degrees
        std::vector<RadarBin> bins;
    };
    
    struct RadarSweep {
        std::string station_id;
        uint32_t timestamp;       // UNIX or raw timestamp
        float bin_size_meters;
        std::vector<RadarRadial> radials;
    };

    std::vector<uint8_t> decompress_bzip2(const std::vector<uint8_t> &compressed_data);
    RadarSweep parse_packet_16(const std::vector<uint8_t>& data);
}