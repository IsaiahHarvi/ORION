#include <iostream>
#include "nexrad_parser.hpp"
#include "utils/ftp_client.hpp"
#include "nexrad_visualizer.hpp"
#include "nexrad_processor.hpp"

int main()
{
    auto raw = Utils::FtpClient::download_single("ftp://tgftp.nws.noaa.gov/SL.us008001/DF.of/DC.radar/DS.p94r0/SI.kenx/sn.last");
    auto decompressed = NEXRAD::Parser::decompress_bzip2(raw);
    NEXRAD::RadarSweep sweep = NEXRAD::Parser::parse_packet_16(decompressed);
    vector<NEXRAD::ProcessedPoint> points = NEXRAD::Processor::process_data(sweep, "kenx");

    for (const auto &point : points)
    {
        std::cout << "x: " << point.x << ", y: " << point.y << ", dBZ: " << point.value << std::endl;
    }

    return 0;
}