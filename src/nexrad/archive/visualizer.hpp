#pragma once
#include <string>
#include "parser.hpp"

class Visualizer
{
public:
    static void save_image(const parser::RadarSweep &sweep, const std::string &filename, double lat, double lon, const std::string &station);
    static void draw_filled_triangle(
        std::vector<uint8_t> &img, int width, int height,
        float x0, float y0, float x1, float y1, float x2, float y2,
        uint8_t r, uint8_t g, uint8_t b, uint8_t a);
    static void draw_filled_quad(
        std::vector<uint8_t> &img, int width, int height,
        float x0, float y0, float x1, float y1,
        float x2, float y2, float x3, float y3,
        uint8_t r, uint8_t g, uint8_t b, uint8_t a);
};
