#include "stations.hpp"
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <cctype>
#include <vector>

std::unordered_map<std::string, std::pair<double, double>> Stations::station_map;

void Stations::load_csv(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) throw std::runtime_error("Failed to open stations CSV");

    std::string line;
    std::getline(file, line); // Skip header

    while (std::getline(file, line)) {
        std::vector<std::string> fields;
        std::string field;
        bool in_quotes = false;

        for (size_t i = 0; i < line.size(); ++i) {
            char c = line[i];

            if (c == '"') {
                in_quotes = !in_quotes;
            } else if (c == ',' && !in_quotes) {
                fields.push_back(field);
                field.clear();
            } else {
                field += c;
            }
        }

        fields.push_back(field); // Push final field

        if (fields.size() < 6) continue;

        std::string id_upper = to_upper(fields[1]);

        try {
            double lat = std::stod(fields[4]);
            double lon = std::stod(fields[5]);
            station_map[id_upper] = { lat, lon };
        } catch (...) {
            continue;
        }
    }
}

std::pair<double, double> Stations::get(const std::string& id) {
    std::string upper = to_upper(id);
    auto it = station_map.find(upper);
    if (it == station_map.end())
        throw std::runtime_error("Station ID not found: " + id);
    return it->second;
}

std::vector<std::string> Stations::get_stations_by_code() {
    std::vector<std::string> ids;
    for (const auto& pair : station_map) {
        ids.push_back(pair.first);
    }
    return ids;
}

std::string Stations::to_upper(const std::string& str) {
    std::string result;
    for (char c : str)
        result += std::toupper(static_cast<unsigned char>(c));
    return result;
}
