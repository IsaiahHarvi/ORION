#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "Visualizer.hpp"
#include "stb_image_write.h"
#include <cmath>
#include <vector>
#include <iostream>
#include <cstdint>
#include <math.h>
#include <algorithm>
#include "mercator.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct Color {
    uint8_t r, g, b, a;
};

Color dbz_to_rgba(float dbz) {
    struct ColorStop {
        float dbz;
        uint8_t r, g, b;
    };

    static const std::vector<ColorStop> gradient = {
        {  0.0f,   0, 100,   0 },
        {  5.0f,   0, 180,   0 },
        { 10.0f,   0, 255,   0 },
        { 20.0f, 180, 255,   0 },
        { 30.0f, 255, 255,   0 },
        { 40.0f, 255, 200,   0 },
        { 50.0f, 255, 128,   0 },
        { 60.0f, 255,  64,   0 },
        { 70.0f, 255,   0,   0 }
    };

    if (dbz < gradient.front().dbz) return {0, 0, 0, 0};
    if (dbz >= gradient.back().dbz) return {255, 0, 0, 255};

    for (size_t i = 0; i < gradient.size() - 1; ++i) {
        const auto& a = gradient[i];
        const auto& b = gradient[i + 1];
        if (dbz >= a.dbz && dbz <= b.dbz) {
            float t = (dbz - a.dbz) / (b.dbz - a.dbz);
            uint8_t r = static_cast<uint8_t>(a.r + t * (b.r - a.r));
            uint8_t g = static_cast<uint8_t>(a.g + t * (b.g - a.g));
            uint8_t b_ = static_cast<uint8_t>(a.b + t * (b.b - a.b));
            return {r, g, b_, 255};
        }
    }

    return {0, 0, 0, 0}; // fallback
}

void Visualizer::draw_filled_quad(
    std::vector<uint8_t>& img, int width, int height,
    float x0, float y0, float x1, float y1,
    float x2, float y2, float x3, float y3,
    uint8_t r, uint8_t g, uint8_t b, uint8_t a = 255
) {
    draw_filled_triangle(img, width, height, x0, y0, x1, y1, x2, y2, r, g, b, a);
    draw_filled_triangle(img, width, height, x2, y2, x3, y3, x0, y0, r, g, b, a);
}

void Visualizer::draw_filled_triangle(
    std::vector<uint8_t>& img, int width, int height,
    float x0, float y0, float x1, float y1, float x2, float y2,
    uint8_t r, uint8_t g, uint8_t b, uint8_t a
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
                img[idx + 3] = a;
            }
        }
    }
}

void destination_point(double lat1_rad, double lon1_rad, double bearing_rad, double distance_m, 
                        double* lat2_rad, double* lon2_rad) {
    const double R = 6371000.0; // Earth radius in meters
    
    double angular_dist = distance_m / R;
    
    double sin_lat1 = sin(lat1_rad);
    double cos_lat1 = cos(lat1_rad);
    double sin_dist = sin(angular_dist);
    double cos_dist = cos(angular_dist);
    double sin_bearing = sin(bearing_rad);
    double cos_bearing = cos(bearing_rad);
    
    double lat2 = asin(sin_lat1 * cos_dist + cos_lat1 * sin_dist * cos_bearing);
    double lon2 = lon1_rad + atan2(sin_bearing * sin_dist * cos_lat1, 
                                  cos_dist - sin_lat1 * sin(lat2));
    
    *lat2_rad = lat2;
    *lon2_rad = lon2;
}

double lat_to_y(double lat_rad) {
    return 0.5 - log(tan(M_PI/4 + lat_rad/2)) / (2 * M_PI);
}

double lon_to_x(double lon_rad) {
    return lon_rad / (2 * M_PI) + 0.5;
}

void gaussian_blur(std::vector<uint8_t>& img, int width, int height, int radius) {
    if (radius <= 0) return;

    int size = radius * 2 + 1;
    std::vector<float> kernel(size);
    float sigma = radius / 2.0f;
    float sum = 0.0f;

    for (int i = 0; i < size; ++i) {
        int x = i - radius;
        kernel[i] = std::exp(-(x * x) / (2 * sigma * sigma));
        sum += kernel[i];
    }
    for (float& k : kernel) k /= sum;

    std::vector<uint8_t> temp = img;

    // horizontal pass
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            for (int c = 0; c < 4; ++c) {
                float acc = 0.0f;
                for (int i = -radius; i <= radius; ++i) {
                    int xi = std::clamp(x + i, 0, width - 1);
                    acc += kernel[i + radius] * temp[(y * width + xi) * 4 + c];
                }
                img[(y * width + x) * 4 + c] = static_cast<uint8_t>(acc);
            }
        }
    }

    temp = img;

    // vertical pass
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            for (int c = 0; c < 4; ++c) {
                float acc = 0.0f;
                for (int i = -radius; i <= radius; ++i) {
                    int yi = std::clamp(y + i, 0, height - 1);
                    acc += kernel[i + radius] * temp[(yi * width + x) * 4 + c];
                }
                img[(y * width + x) * 4 + c] = static_cast<uint8_t>(acc);
            }
        }
    }
}


void Visualizer::save_image(const parser::RadarSweep& sweep, const std::string& filename, double lat_deg, double lon_deg) {
    int width = 1024;
    int height = 1024;
    int radial_interp = 2;
    int bin_interp = 1;
    
    std::vector<uint8_t> img(width * height * 4, 0); // RGBA

    double lat_rad = lat_deg * M_PI / 180.0;
    double lon_rad = lon_deg * M_PI / 180.0;
    
    double radar_x = lon_to_x(lon_rad);
    double radar_y = lat_to_y(lat_rad);

    const double R = 6378137.0; // Earth radius for Web Mercator
    double meters_per_pixel = 500.0;
    double scale = (2 * M_PI * R * cos(lat_rad)) / meters_per_pixel;

    double center_x = width / 2.0;
    double center_y = height / 2.0;

    for (size_t i = 0; i + 1 < sweep.radials.size(); ++i) {
        const auto& radial1 =  sweep.radials[i];
        const auto& radial2 =  sweep.radials[i + 1];

        double angle1 = radial1.angle * M_PI / 180.0;
        double angle2 = radial2.angle * M_PI / 180.0;

        size_t bin_count = std::min(radial1.bins.size(), radial2.bins.size());

        for (size_t j = 0; j + 1 < bin_count; ++j) {
            double range1 = j * sweep.bin_size_meters;
            double range2 = (j + 1) * sweep.bin_size_meters;

            double lat1, lon1, lat2, lon2, lat3, lon3, lat4, lon4;
            
            destination_point(lat_rad, lon_rad, angle1, range1, &lat1, &lon1);
            destination_point(lat_rad, lon_rad, angle1, range2, &lat2, &lon2);
            destination_point(lat_rad, lon_rad, angle2, range2, &lat3, &lon3);
            destination_point(lat_rad, lon_rad, angle2, range1, &lat4, &lon4);

            double x1 = lon_to_x(lon1);
            double y1 = lat_to_y(lat1);
            double x2 = lon_to_x(lon2);
            double y2 = lat_to_y(lat2);
            double x3 = lon_to_x(lon3);
            double y3 = lat_to_y(lat3);
            double x4 = lon_to_x(lon4);
            double y4 = lat_to_y(lat4);

            float py1 = center_y + (y1 - radar_y) * scale;
            float py2 = center_y + (y2 - radar_y) * scale;
            float py3 = center_y + (y3 - radar_y) * scale;
            float py4 = center_y + (y4 - radar_y) * scale;
            
            float px1 = center_x - (x1 - radar_x) * scale;
            float px2 = center_x - (x2 - radar_x) * scale;
            float px3 = center_x - (x3 - radar_x) * scale;
            float px4 = center_x - (x4 - radar_x) * scale;

            float dbz = radial1.bins[j].value;
            if (dbz < 10.0f) continue;

            Color rgb = dbz_to_rgba(dbz);
            draw_filled_quad(img, width, height, px1, py1, px2, py2, px3, py3, px4, py4, rgb.r, rgb.g, rgb.b, rgb.a);
        }
    }

    gaussian_blur(img, width, height, 2);
    stbi_write_png(filename.c_str(), width, height, 4, img.data(), width * 4);
}