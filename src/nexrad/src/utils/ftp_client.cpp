#include <curl/curl.h>
#include <string>
#include <vector>
#include <thread>
#include <mutex>
#include <unordered_map>
#include <ctime>
#include "utils/ftp_client.hpp"

namespace Utils
{
    namespace
    {
        size_t write_to_vector(void *ptr, size_t size, size_t nmemb, void *userdata)
        {
            auto *data = static_cast<std::vector<uint8_t> *>(userdata);
            size_t total_size = size * nmemb;
            data->insert(data->end(), static_cast<uint8_t *>(ptr), static_cast<uint8_t *>(ptr) + total_size);
            return total_size;
        }
    }

    std::vector<uint8_t> FtpClient::download_single(const std::string &url)
    {
        std::vector<uint8_t> data;
        CURL *curl = curl_easy_init();
        if (curl)
        {
            curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
            curl_easy_setopt(curl, CURLOPT_USERPWD, "anonymous:anonymous");
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_to_vector);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &data);
            curl_easy_setopt(curl, CURLOPT_FTP_RESPONSE_TIMEOUT, 10L);
            curl_easy_perform(curl);
            curl_easy_cleanup(curl);
        }
        return data;
    }

    std::unordered_map<std::string, FtpClient::FtpFileResult> FtpClient::download_many_threaded(const std::vector<std::string> &urls)
    {
        std::unordered_map<std::string, FtpFileResult> results;
        std::mutex mutex;
        std::vector<std::thread> threads;

        for (const auto &url : urls)
        {
            threads.emplace_back([&results, &mutex, url]()
                                 {
                std::vector<uint8_t> data;
                std::time_t mod_time = 0;
                bool is_fresh = false;
                bool was_fetched = false;

                CURL *curl = curl_easy_init();
                if (curl)
                {
                    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
                    curl_easy_setopt(curl, CURLOPT_USERPWD, "anonymous:anonymous");
                    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_to_vector);
                    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &data);
                    curl_easy_setopt(curl, CURLOPT_FTP_RESPONSE_TIMEOUT, 10L);
                    curl_easy_setopt(curl, CURLOPT_FILETIME, 1L);

                    if (curl_easy_perform(curl) == CURLE_OK)
                    {
                        long filetime;
                        if (curl_easy_getinfo(curl, CURLINFO_FILETIME, &filetime) == CURLE_OK && filetime >= 0)
                        {
                            mod_time = static_cast<std::time_t>(filetime);
                        }

                        was_fetched = true;
                        std::time_t now = std::time(nullptr);
                        is_fresh = mod_time && (now - mod_time <= 300);
                    }

                    curl_easy_cleanup(curl);
                }

                std::lock_guard<std::mutex> lock(mutex);
                results[url] = FtpFileResult{std::move(data), mod_time, is_fresh, was_fetched}; });
        }

        for (auto &t : threads)
            t.join();

        return results;
    }
}
