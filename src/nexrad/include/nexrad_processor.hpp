#pragma once

#include <vector>
#include "nexrad_parser.hpp"

namespace NEXRAD
{
    struct ProcessedPoint
    {
        float x;
        float y;
        float value;
    };

    /*
    Processes weather data into a format for visualizing/saving.
    */
    class Processor
    {
    public:
        static std::vector<ProcessedPoint> process_data(const RadarSweep &sweep, string station);
        static void mercator_project();

    private:
    };
} // namespace NEXRAD
