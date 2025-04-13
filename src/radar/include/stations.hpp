#pragma once
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

class Stations {
public:
    static void load_csv(const std::string& filepath);
    static std::pair<double, double> get(const std::string& id);
    static std::vector<std::string> get_stations_by_code();
private:
    static std::unordered_map<std::string, std::pair<double, double>> station_map;
    static std::string to_upper(const std::string& str);
};
