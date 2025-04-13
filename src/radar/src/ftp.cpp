#include <curl/curl.h>
#include <string>
#include <vector>
#include <thread>
#include <mutex>
#include <unordered_map>
#include "ftp.hpp"

size_t write_to_vector(void *ptr, size_t size, size_t nmemb, void *userdata) {
    std::vector<uint8_t> *data = static_cast<std::vector<uint8_t> *>(userdata);
    size_t total_size = size * nmemb;
    data->insert(data->end(), static_cast<uint8_t *>(ptr), static_cast<uint8_t *>(ptr) + total_size);
    return total_size;
}

// IGNORE `RKSG` and `RKJK`

std::vector<uint8_t> FTP::download_single(const std::string &url) {
    std::vector<uint8_t> data;
    CURL *curl = curl_easy_init();
    if (curl) {
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

std::unordered_map<std::string, FTP::FtpFileResult> FTP::download_many_threaded(const std::vector<std::string>& urls) {
    std::unordered_map<std::string, FtpFileResult> results;
    std::mutex mutex;
    std::vector<std::thread> threads;

    for (const std::string& url : urls) {
        threads.emplace_back([&results, &mutex, url]() {
            std::vector<uint8_t> data;
            std::time_t mod_time = 0;
            bool is_fresh = false;
            bool was_fetched = false;

            CURL *curl = curl_easy_init();
            if (curl) {
                curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
                curl_easy_setopt(curl, CURLOPT_USERPWD, "anonymous:anonymous");
                curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_to_vector);
                curl_easy_setopt(curl, CURLOPT_WRITEDATA, &data);
                curl_easy_setopt(curl, CURLOPT_FTP_RESPONSE_TIMEOUT, 10L);
                curl_easy_setopt(curl, CURLOPT_FILETIME, 1L);

                if (curl_easy_perform(curl) == CURLE_OK) {                    
                    long filetime;
                    curl_easy_getinfo(curl, CURLINFO_FILETIME, &filetime);
                    mod_time = (filetime == -1) ? 0 : static_cast<std::time_t>(filetime);

                    std::time_t now = std::time(nullptr);
                    is_fresh = was_fetched == false || mod_time && (now - mod_time <= 300);
                    was_fetched = true;
                }

                curl_easy_cleanup(curl);
            }

            std::lock_guard<std::mutex> lock(mutex);
            results[url] = FtpFileResult{ std::move(data), mod_time, is_fresh, was_fetched };
        });
    }

    for (auto& t : threads) t.join();
    return results;
}
