#pragma once
#include <vector>
#include <cstdint>
#include <string>

using namespace std;

namespace NEXRAD
{
    struct RadarBin
    {
        float value;
    };

    struct RadarRadial
    {
        float angle; // in degrees
        vector<RadarBin> bins;
    };

    struct RadarSweep
    {
        string station_id;
        uint32_t timestamp; // UNIX
        float bin_size_meters;
        uint16_t first_bin;
        vector<RadarRadial> radials;
    };

    class Parser
    {
    public:
        static vector<uint8_t> decompress_bzip2(const vector<uint8_t> &compressed_data);
        static RadarSweep parse_packet_16(const vector<uint8_t> &data);
    };
} // namespace NEXRAD