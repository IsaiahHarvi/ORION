#pragma once

namespace NEXRAD
{
    class Visualizer
    {
    public:
        static void save_station_product_image();
        static void get_station_product();

    private:
        static void draw_filled_triangle();
        static void draw_filled_quad();
    };
} // namespace NEXRAD