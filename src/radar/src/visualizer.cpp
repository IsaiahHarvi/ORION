#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "Visualizer.hpp"
#include "stb_image_write.h"
#include <cmath>
#include <vector>
#include <iostream>
#include <cstdint>
#include <math.h>
#include "mercator.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct Color {
    uint8_t r, g, b;
};

Color dbz_to_rgb(float dbz) {
    if (dbz >= 75) return {222, 222, 255};
    if (dbz >= 70) return {255, 0, 255};
    if (dbz >= 65) return {255, 0, 180};
    if (dbz >= 60) return {255, 0, 0};
    if (dbz >= 55) return {255, 100, 0};
    if (dbz >= 50) return {255, 165, 0};
    if (dbz >= 46) return {255, 220, 0};
    if (dbz >= 40) return {255, 255, 0};
    if (dbz >= 35) return {200, 255, 0};
    if (dbz >= 30) return {150, 255, 0};
    if (dbz >= 25) return {0, 255, 0};
    if (dbz >= 20) return {0, 255, 255};
    if (dbz >= 15) return {0, 200, 255};
    if (dbz >= 10) return {0, 150, 255};
    if (dbz >= 5)  return {0, 100, 255};
    if (dbz >= 0)  return {0, 50, 255};
    if (dbz >= -5) return {150, 150, 150};
    if (dbz >= -10) return {100, 100, 100};
    if (dbz >= -15) return {75, 75, 75};
    if (dbz >= -20) return {175, 0, 175};
    if (dbz >= -25) return {200, 150, 200};
    if (dbz >= -30) return {255, 200, 255};
    return {100, 100, 100}; // ND (no data)
}

void Visualizer::draw_filled_quad(
    std::vector<uint8_t>& img, int width, int height,
    float x0, float y0, float x1, float y1,
    float x2, float y2, float x3, float y3,
    uint8_t r, uint8_t g, uint8_t b
) {
    draw_filled_triangle(img, width, height, x0, y0, x1, y1, x2, y2, r, g, b);
    draw_filled_triangle(img, width, height, x2, y2, x3, y3, x0, y0, r, g, b);
}

void Visualizer::draw_filled_triangle(
    std::vector<uint8_t>& img, int width, int height,
    float x0, float y0, float x1, float y1, float x2, float y2,
    uint8_t r, uint8_t g, uint8_t b
) {
    auto edge_function = [](float x0, float y0, float x1, float y1, float x, float y) {
        return (x - x0) * (y1 - y0) - (y - y0) * (x1 - x0);
    };

    int min_x = static_cast<int>(std::floor(std::min(std::min(x0, x1), x2)));
    int max_x = static_cast<int>(std::ceil(std::max(std::max(x0, x1), x2)));
    int min_y = static_cast<int>(std::floor(std::min(std::min(y0, y1), y2)));
    int max_y = static_cast<int>(std::ceil(std::max(std::max(y0, y1), y2)));
    
    min_x = std::max(min_x, 0);
    max_x = std::min(max_x, width - 1);
    min_y = std::max(min_y, 0);
    max_y = std::min(max_y, height - 1);

    float area = edge_function(x0, y0, x1, y1, x2, y2);
    if (area == 0.0f) return;

    for (int y = min_y; y <= max_y; ++y) {
        for (int x = min_x; x <= max_x; ++x) {
            float w0 = edge_function(x1, y1, x2, y2, x, y);
            float w1 = edge_function(x2, y2, x0, y0, x, y);
            float w2 = edge_function(x0, y0, x1, y1, x, y);

            if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
                int idx = (y * width + x) * 4;
                img[idx + 0] = r;
                img[idx + 1] = g;
                img[idx + 2] = b;
                img[idx + 3] = 255;
            }
        }
    }
}

void Visualizer::save_image(const parser::RadarSweep& sweep, const std::string& filename, double lat_deg, double lon_deg) {
    int width = 512;
    int height = 512;

    std::vector<uint8_t> img(width * height * 4, 0); // RGBA

    float lat_rad = lat_deg * M_PI / 180.0f;
    float lon_rad = lon_deg * M_PI / 180.0f;

    float radar_easting = 0.0f;
    float radar_northing = 0.0f;
    Convert_Geodetic_To_Mercator(lat_rad, lon_rad, &radar_easting, &radar_northing);

    float center_x = width / 2.0f;
    float center_y = height / 2.0f;
    float meters_per_pixel = 1000.0f;

    for (size_t i = 0; i + 1 < sweep.radials.size(); ++i) {
        const auto& radial1 = sweep.radials[i];
        const auto& radial2 = sweep.radials[i + 1];

        float angle1 = radial1.angle * M_PI / 180.0f;
        float angle2 = radial2.angle * M_PI / 180.0f;

        size_t bin_count = std::min(radial1.bins.size(), radial2.bins.size());

        for (size_t j = 0; j + 1 < bin_count; ++j) {
            float range1 = j * sweep.bin_size_meters;
            float range2 = (j + 1) * sweep.bin_size_meters;

            float dlat1 = (range1 / 6371000.0f) * cosf(angle1);
            float dlon1 = (range1 / 6371000.0f) * sinf(angle1) / cosf(lat_rad);
            float dlat2 = (range2 / 6371000.0f) * cosf(angle1);
            float dlon2 = (range2 / 6371000.0f) * sinf(angle1) / cosf(lat_rad);

            float lat1 = lat_rad + dlat1;
            float lon1 = lon_rad + dlon1;
            float lat2 = lat_rad + dlat2;
            float lon2 = lon_rad + dlon2;

            float dlat3 = (range2 / 6371000.0f) * cosf(angle2);
            float dlon3 = (range2 / 6371000.0f) * sinf(angle2) / cosf(lat_rad);
            float dlat4 = (range1 / 6371000.0f) * cosf(angle2);
            float dlon4 = (range1 / 6371000.0f) * sinf(angle2) / cosf(lat_rad);

            float lat3 = lat_rad + dlat3;
            float lon3 = lon_rad + dlon3;
            float lat4 = lat_rad + dlat4;
            float lon4 = lon_rad + dlon4;

            float e1, n1, e2, n2, e3, n3, e4, n4;
            Convert_Geodetic_To_Mercator(lat1, lon1, &e1, &n1);
            Convert_Geodetic_To_Mercator(lat2, lon2, &e2, &n2);
            Convert_Geodetic_To_Mercator(lat3, lon3, &e3, &n3);
            Convert_Geodetic_To_Mercator(lat4, lon4, &e4, &n4);

            float x0 = center_x + (e1 - radar_easting) / meters_per_pixel;
            float y0 = center_y - (n1 - radar_northing) / meters_per_pixel;
            float x1 = center_x + (e2 - radar_easting) / meters_per_pixel;
            float y1 = center_y - (n2 - radar_northing) / meters_per_pixel;
            float x2 = center_x + (e3 - radar_easting) / meters_per_pixel;
            float y2 = center_y - (n3 - radar_northing) / meters_per_pixel;
            float x3 = center_x + (e4 - radar_easting) / meters_per_pixel;
            float y3 = center_y - (n4 - radar_northing) / meters_per_pixel;

            float dbz = radial1.bins[j].value;
            if (dbz < 5.0f) continue;

            Color rgb = dbz_to_rgb(dbz);
            draw_filled_quad(img, width, height, x0, y0, x1, y1, x2, y2, x3, y3, rgb.r, rgb.g, rgb.b);
        }
    }

    stbi_write_png(filename.c_str(), width, height, 4, img.data(), width * 4);
}
