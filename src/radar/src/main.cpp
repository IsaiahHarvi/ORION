#include <iostream>
#include <bzlib.h>
#include "ftp.hpp"
#include "parser.hpp"
#include "visualizer.hpp"
#include <iostream>
#include <fstream>
#include <cstdint>
#include <algorithm>
#include <cctype>
#include <stations.hpp>

void write_to_file(const std::vector<uint8_t>& data, const std::string& filename = "output") {
    std::ofstream file(filename, std::ios::binary);
    file.write(reinterpret_cast<const char*>(data.data()), data.size());
    file.close();
}

std::string extract_code(const std::string& url) {
    auto si_pos = url.find("/SI.");
    if (si_pos == std::string::npos) return "";

    auto start = si_pos + 4;
    auto end = url.find('/', start);
    if (end == std::string::npos) return "";

    std::string code = url.substr(start, end - start);
    std::transform(code.begin(), code.end(), code.begin(), ::toupper);
    return code;
}

void load_all() {
    Stations::load_csv("data/nexrad_stations.csv");
    auto [lat, lon] = Stations::get("KCBW");

    auto codes = Stations::get_stations_by_code();
    std::vector<std::string> urls;
    
    for (const auto& code : codes) {
        if (code == "RKSG" || code == "RKJK") {
            continue;
        }

        std::string lower_code = code;
        std::transform(lower_code.begin(), lower_code.end(), lower_code.begin(), ::tolower);
    
        std::string url = "ftp://tgftp.nws.noaa.gov/SL.us008001/DF.of/DC.radar/DS.p94r0/SI." + lower_code + "/sn.last";
        urls.push_back(url);
    }
    
    auto results = FTP::download_many_threaded(urls);

    for (const auto& [url, result] : results) {
        if (!result.was_fetched || !result.is_fresh) continue;
    
        try {
            std::string code = extract_code(url);
            auto decompressed = parser::decompress_bzip2(result.data);
            parser::RadarSweep sweep = parser::parse_packet_16(decompressed);
            auto [lat, lon] = Stations::get(code);
            std::string filename = "outputs/" + code + ".png";
            Visualizer::save_image(sweep, filename, lat, lon);
        } catch (const std::exception& e) {
            std::string code = extract_code(url);
            std::cerr << "⚠️ Skipping " << code << ": " << e.what() << std::endl;
        }
    }
}

void load_one() {
    Stations::load_csv("data/nexrad_stations.csv");
    auto [lat, lon] = Stations::get("KRLX");

    auto raw = FTP::download_single("ftp://tgftp.nws.noaa.gov/SL.us008001/DF.of/DC.radar/DS.p94r0/SI.krlx/sn.last");
    auto decompressed = parser::decompress_bzip2(raw);
    parser::RadarSweep sweep = parser::parse_packet_16(decompressed);
    Visualizer::save_image(sweep, "outputs/radar.png", lat, lon);
}

int main() {
    //load_all();
    load_one();
    
    return 0;
}