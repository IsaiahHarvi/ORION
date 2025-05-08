#pragma once

#include <array>
#include <cstdint>

namespace Utils
{
    struct RGBA
    {
        uint8_t r, g, b, a;
    };

    class DBZColorMap
    {
    public:
        static constexpr float min_dbz = -30.0f;
        static constexpr float max_dbz = 75.0f;

        static RGBA map(float dbz)
        {
            if (dbz < min_dbz)
                dbz = min_dbz;
            if (dbz > max_dbz)
                dbz = max_dbz;
            float t = (dbz - min_dbz) / (max_dbz - min_dbz);
            return interpolate(t);
        }

    private:
        static RGBA interpolate(float t)
        {
            constexpr std::array<RGBA, 7> palette = {{
                {0, 0, 0, 255},     // underflow, whatever that means
                {0, 0, 255, 255},   // blue
                {0, 255, 255, 255}, // cyan
                {0, 255, 0, 255},   // green
                {255, 255, 0, 255}, // yellow
                {255, 128, 0, 255}, // orange
                {255, 0, 0, 255},   // red
            }};
            size_t idx = static_cast<size_t>(t * (palette.size() - 1));
            float frac = t * (palette.size() - 1) - idx;

            if (idx >= palette.size() - 1)
                return palette.back();
            const RGBA &a = palette[idx];
            const RGBA &b = palette[idx + 1];

            return {
                static_cast<uint8_t>(a.r + frac * (b.r - a.r)),
                static_cast<uint8_t>(a.g + frac * (b.g - a.g)),
                static_cast<uint8_t>(a.b + frac * (b.b - a.b)),
                static_cast<uint8_t>(a.a + frac * (b.a - a.a)),
            };
        }
    };
}