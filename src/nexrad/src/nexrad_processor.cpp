#include "nexrad_processor.hpp"
#include "utils/stations.hpp"
#include <string>
#include <algorithm>
#include <cctype>
#include <numbers>

using namespace std;

// Happy now?
constexpr double M_PI = numbers::pi;

namespace NEXRAD
{
    vector<ProcessedPoint> Processor::process_data(const RadarSweep &sweep, string station)
    {
        vector<ProcessedPoint> points;

        for (size_t radial_index = 0; radial_index < sweep.radials.size(); radial_index++)
        {
            RadarRadial radial = sweep.radials[radial_index];

            for (size_t bin_index = 0; bin_index < sweep.radials[radial_index].bins.size(); bin_index++)
            {
                RadarBin bin = radial.bins[bin_index];

                float origin_distance = (sweep.first_bin + bin_index) * sweep.bin_size_meters;
                float angle = radial.angle * M_PI / 180.0f;

                float x = origin_distance * cos(angle);
                float y = origin_distance * sin(angle);
                float dBZ = bin.value;

                ProcessedPoint point = {
                    x,
                    y,
                    dBZ};

                points.push_back(point);
            }
        }

        return points;
    }
}