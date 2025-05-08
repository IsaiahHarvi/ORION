#pragma once
#include <string>
#include <cstdint>
#include <vector>
#include <unordered_map>
#include <ctime>

namespace Utils
{
    class FtpClient
    {
    public:
        struct FtpFileResult
        {
            std::vector<uint8_t> data;
            std::time_t date_modified;
            bool is_fresh;
            bool was_fetched;
        };

        static std::vector<uint8_t> download_single(const std::string &url);
        static std::unordered_map<std::string, FtpFileResult> download_many_threaded(const std::vector<std::string> &urls);
    };

}