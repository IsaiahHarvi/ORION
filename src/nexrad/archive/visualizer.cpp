#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "Visualizer.hpp"
#include "stb_image_write.h"
#include <cmath>
#include <vector>
#include <iostream>
#include <cstdint>
#include <math.h>
#include <algorithm>
#include <fstream>
#include "mercator.h"
#include "gdal_priv.h"
#include "cpl_conv.h"
#include <ctime>
#include <sstream>
#include <iomanip>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static constexpr float DBZ_MIN = -32.0f;
static constexpr float DBZ_MAX = 75.0f;
static constexpr float DBZ_FILL = -9999.0f;

struct Color
{
    uint8_t r, g, b, a;
};

Color dbz_to_rgba(float dbz)
{
    if (std::isnan(dbz) || std::isinf(dbz) || dbz == DBZ_FILL || dbz < DBZ_MIN || dbz > DBZ_MAX)
    {
        std::fprintf(stderr, "Unusual dbz: %f\n", dbz);
        return {0, 0, 0, 0}; // Make sure to RETURN transparent pixels for invalid data
    }

    if (dbz < 21.0f)
        return {2, 253, 2, 0}; // green
    if (dbz < 25.0f)
        return {1, 197, 1, 255}; // medium green
    if (dbz < 30.0f)
        return {0, 142, 0, 255}; // dark green
    if (dbz < 35.0f)
        return {253, 248, 2, 255}; // yellow
    if (dbz < 40.0f)
        return {229, 188, 0, 255}; // orange-yellow
    if (dbz < 45.0f)
        return {253, 149, 0, 255}; // orange
    if (dbz < 50.0f)
        return {253, 0, 0, 255}; // red
    if (dbz < 55.0f)
        return {212, 0, 0, 255}; // dark red
    if (dbz < 60.0f)
        return {188, 0, 0, 255}; // deeper red
    if (dbz < 65.0f)
        return {255, 0, 255, 255}; // magenta
    if (dbz < 70.0f)
        return {153, 85, 201, 255}; // purple
    return {255, 255, 255, 255};    // white (extreme)
}

void save_geotiff(const std::string &station, const std::vector<uint8_t> &img, int width, int height,
                  double lat_deg, double lon_deg, double meters_per_pixel, const std::string &output_dir)
{
    GDALAllRegister();
    const char *pszFormat = "GTiff";
    GDALDriver *poDriver = GetGDALDriverManager()->GetDriverByName(pszFormat);
    if (!poDriver)
        return;

    std::time_t t = std::time(nullptr);
    std::tm *tm = std::gmtime(&t);
    std::ostringstream oss;
    oss << station << "_" << std::put_time(tm, "%Y%m%d") << ".tif";
    std::string filename = oss.str();

    std::string full_path = output_dir + "/" + filename;

    GDALDataset *poDstDS = poDriver->Create(full_path.c_str(), width, height, 4, GDT_Byte, nullptr);
    if (!poDstDS)
        return;

    double R = 6378137.0;
    double lat_rad = lat_deg * DEG_TO_RAD;
    double center_x = lon_deg * DEG_TO_RAD * R;
    double center_y = R * log(tan(M_PI / 4 + lat_rad / 2));

    double half_width = (width * meters_per_pixel) * 0.5;
    double half_height = (height * meters_per_pixel) * 0.5;

    double x_ul = center_x - half_width;
    double y_ul = center_y + half_height;

    double adfGeoTransform[6] = {x_ul, meters_per_pixel, 0, y_ul, 0, -meters_per_pixel};
    poDstDS->SetGeoTransform(adfGeoTransform);

    OGRSpatialReference oSRS;
    oSRS.importFromEPSG(3857);
    char *pszSRS_WKT = nullptr;
    oSRS.exportToWkt(&pszSRS_WKT);
    poDstDS->SetProjection(pszSRS_WKT);
    CPLFree(pszSRS_WKT);

    for (int c = 0; c < 4; ++c)
    {
        GDALRasterBand *poBand = poDstDS->GetRasterBand(c + 1);
        std::vector<uint8_t> band(width * height);
        for (int i = 0; i < width * height; ++i)
            band[i] = img[i * 4 + c];
        poBand->RasterIO(GF_Write, 0, 0, width, height, band.data(), width, height, GDT_Byte, 0, 0);
        if (c == 3)
            poBand->SetColorInterpretation(GCI_AlphaBand);
    }
    poDstDS->SetMetadataItem("TIFFTAG_SOFTWARE", "Radar Visualizer");
    GDALClose(poDstDS);

    std::ofstream props(full_path + ".properties");
    props << "station=" << station << "\n";
    props << "time=" << std::put_time(tm, "%Y%m%d") << "\n";
    props.close();
}

void write_world_and_projection_file(const std::string &filename, double lat_deg, double lon_deg, int width, int height, double meters_per_pixel)
{
    double R = 6378137.0;
    double lat_rad = lat_deg * DEG_TO_RAD;

    double x_center = lon_deg * R * DEG_TO_RAD;
    double y_center = R * log(tan(M_PI / 4 + lat_rad / 2));
    double x_extent = width * meters_per_pixel;
    double y_extent = height * meters_per_pixel;

    double half_x = x_extent * 0.5;
    double half_y = y_extent * 0.5;
    double x_ul = x_center - half_x;
    double y_ul = y_center + half_y;

    std::string base = filename.substr(0, filename.find_last_of('.'));
    std::ofstream wld(base + ".wld");

    wld << std::fixed << meters_per_pixel << "\n";
    wld << "0.0\n";
    wld << "0.0\n";
    wld << -meters_per_pixel << "\n";
    wld << x_ul + meters_per_pixel * 0.5 << "\n";
    wld << y_ul - meters_per_pixel * 0.5 << "\n";
    wld.close();

    std::ofstream prj(base + ".prj");
    prj << "PROJCS[\"WGS 84 / Pseudo-Mercator\",GEOGCS[\"WGS 84\",DATUM[\"WGS_1984\",SPHEROID[\"WGS 84\",6378137,298.257223563]],PRIMEM[\"Greenwich\",0],UNIT[\"degree\",0.0174532925199433]],PROJECTION[\"Mercator_1SP\"],PARAMETER[\"central_meridian\",0],PARAMETER[\"scale_factor\",1],PARAMETER[\"false_easting\",0],PARAMETER[\"false_northing\",0],UNIT[\"metre\",1,AUTHORITY[\"EPSG\",\"9001\"]],AXIS[\"X\",EAST],AXIS[\"Y\",NORTH],AUTHORITY[\"EPSG\",\"3857\"]]";
    prj.close();
}

void Visualizer::draw_filled_quad(
    std::vector<uint8_t> &img, int width, int height,
    float x0, float y0, float x1, float y1,
    float x2, float y2, float x3, float y3,
    uint8_t r, uint8_t g, uint8_t b, uint8_t a = 255)
{
    draw_filled_triangle(img, width, height, x0, y0, x1, y1, x2, y2, r, g, b, a);
    draw_filled_triangle(img, width, height, x2, y2, x3, y3, x0, y0, r, g, b, a);
}

void Visualizer::draw_filled_triangle(
    std::vector<uint8_t> &img, int width, int height,
    float x0, float y0, float x1, float y1, float x2, float y2,
    uint8_t r, uint8_t g, uint8_t b, uint8_t a)
{
    auto edge_function = [](float x0, float y0, float x1, float y1, float x, float y)
    {
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
    if (area == 0.0f)
        return;

    for (int y = min_y; y <= max_y; ++y)
    {
        for (int x = min_x; x <= max_x; ++x)
        {
            float w0 = edge_function(x1, y1, x2, y2, x, y);
            float w1 = edge_function(x2, y2, x0, y0, x, y);
            float w2 = edge_function(x0, y0, x1, y1, x, y);

            if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0))
            {
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
                       double *lat2_rad, double *lon2_rad)
{
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

double lat_to_y(double lat_rad)
{
    return 0.5 - log(tan(M_PI / 4 + lat_rad / 2)) / (2 * M_PI);
}

double lon_to_x(double lon_rad)
{
    return lon_rad / (2 * M_PI) + 0.5;
}

void gaussian_blur(std::vector<uint8_t> &img, int width, int height, int radius)
{
    if (radius <= 0)
        return;

    int size = radius * 2 + 1;
    std::vector<float> kernel(size);
    float sigma = radius / 2.0f;
    float sum = 0.0f;

    for (int i = 0; i < size; ++i)
    {
        int x = i - radius;
        kernel[i] = std::exp(-(x * x) / (2 * sigma * sigma));
        sum += kernel[i];
    }
    for (float &k : kernel)
        k /= sum;

    std::vector<uint8_t> temp = img;

    // horizontal pass
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            for (int c = 0; c < 4; ++c)
            {
                float acc = 0.0f;
                for (int i = -radius; i <= radius; ++i)
                {
                    int xi = std::clamp(x + i, 0, width - 1);
                    acc += kernel[i + radius] * temp[(y * width + xi) * 4 + c];
                }
                img[(y * width + x) * 4 + c] = static_cast<uint8_t>(acc);
            }
        }
    }

    temp = img;

    // vertical pass
    for (int y = 0; y < height; ++y)
    {
        for (int x = 0; x < width; ++x)
        {
            for (int c = 0; c < 4; ++c)
            {
                float acc = 0.0f;
                for (int i = -radius; i <= radius; ++i)
                {
                    int yi = std::clamp(y + i, 0, height - 1);
                    acc += kernel[i + radius] * temp[(yi * width + x) * 4 + c];
                }
                img[(y * width + x) * 4 + c] = static_cast<uint8_t>(acc);
            }
        }
    }
}

void Visualizer::save_image(const parser::RadarSweep &sweep, const std::string &filename, double lat_deg, double lon_deg, const std::string &station)
{
    int width = 2000;
    int height = 2000;

    double meters_per_pixel = 250.0;
    const double R = 6378137.0; // Web Mercator Earth radius
    int radial_interp = 2;
    int bin_interp = 1;

    std::vector<uint8_t> img(width * height * 4, 0); // RGBA

    double lat_rad = lat_deg * M_PI / 180.0;
    double lon_rad = lon_deg * M_PI / 180.0;

    double radar_x = R * lon_rad;
    double radar_y = R * log(tan(M_PI / 4 + lat_rad / 2));

    double center_x = width / 2.0;
    double center_y = height / 2.0;

    std::vector<parser::RadarRadial> sorted_radials = sweep.radials;
    std::sort(sorted_radials.begin(), sorted_radials.end(), [](const auto &a, const auto &b)
              { return a.angle < b.angle; });

    for (size_t i = 0; i + 1 < sorted_radials.size(); ++i)
    {
        const auto &radial1 = sorted_radials[i];
        const auto &radial2 = sorted_radials[i + 1];

        double angle1 = radial1.angle * M_PI / 180.0;
        double angle2 = radial2.angle * M_PI / 180.0;

        size_t bin_count = std::min(radial1.bins.size(), radial2.bins.size());

        for (size_t j = 0; j + 1 < bin_count; ++j)
        {
            double range1 = (sweep.first_bin + j) * sweep.bin_size_meters;
            double range2 = (sweep.first_bin + j + 1) * sweep.bin_size_meters;

            double lat1, lon1, lat2, lon2, lat3, lon3, lat4, lon4;

            auto clamp_lat = [](double lat_rad) -> double
            {
                return std::max(std::min(lat_rad, 1.484422), -1.484422);
            };

            destination_point(lat_rad, lon_rad, angle1, range1, &lat1, &lon1);
            destination_point(lat_rad, lon_rad, angle1, range2, &lat2, &lon2);
            destination_point(lat_rad, lon_rad, angle2, range2, &lat3, &lon3);
            destination_point(lat_rad, lon_rad, angle2, range1, &lat4, &lon4);

            // Clamp latitudes before projection
            lat1 = clamp_lat(lat1);
            lat2 = clamp_lat(lat2);
            lat3 = clamp_lat(lat3);
            lat4 = clamp_lat(lat4);

            auto mercator_y = [](double lat_rad) -> double
            {
                const double R = 6378137.0;

                if (lat_rad > M_PI / 2.0)
                    lat_rad = M_PI / 2.0;
                if (lat_rad < -M_PI / 2.0)
                    lat_rad = -M_PI / 2.0;
                return R * log(tan(M_PI / 4.0 + lat_rad * 0.5));
            };

            double x1 = R * lon1;
            double y1 = mercator_y(lat1);
            double x2 = R * lon2;
            double y2 = mercator_y(lat2);
            double x3 = R * lon3;
            double y3 = mercator_y(lat3);
            double x4 = R * lon4;
            double y4 = mercator_y(lat4);

            float px1 = center_x + (x1 - radar_x) / meters_per_pixel;
            float py1 = center_y - (y1 - radar_y) / meters_per_pixel;
            float px2 = center_x + (x2 - radar_x) / meters_per_pixel;
            float py2 = center_y - (y2 - radar_y) / meters_per_pixel;
            float px3 = center_x + (x3 - radar_x) / meters_per_pixel;
            float py3 = center_y - (y3 - radar_y) / meters_per_pixel;
            float px4 = center_x + (x4 - radar_x) / meters_per_pixel;
            float py4 = center_y - (y4 - radar_y) / meters_per_pixel;

            float dbz1 = radial1.bins[j].value;
            float dbz2 = radial2.bins[j].value;

            Color rgb = dbz_to_rgba(dbz1);
            draw_filled_quad(img, width, height, px1, py1, px2, py2, px3, py3, px4, py4, rgb.r, rgb.g, rgb.b, rgb.a);
        }
    }

    // gaussian_blur(img, width, height, 2);
    // save_geotiff(station, img, 2000, 2000, 35.3331, -97.2775, 250.0, "outputs/");
    stbi_write_png(filename.c_str(), width, height, 4, img.data(), width * 4);
    write_world_and_projection_file(filename, lat_deg, lon_deg, width, height, meters_per_pixel);
}