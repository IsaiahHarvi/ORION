cmake_minimum_required(VERSION 3.21)
project(RadarDownloader)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_BUILD_TYPE Release)

# Tell CMake to use vcpkg toolchain
# Only needed when configuring with -DCMAKE_TOOLCHAIN_FILE
set(CMAKE_TOOLCHAIN_FILE "C:/Users/aidan/vcpkg/scripts/buildsystems/vcpkg.cmake")

# Add your source files
file(GLOB_RECURSE SRC_FILES "src/*.cpp")

add_executable(main ${SRC_FILES})

# Link curl and bzip2 from vcpkg
find_package(CURL REQUIRED)
find_package(BZip2 REQUIRED)
find_package(GDAL REQUIRED)
find_package(unofficial-sqlite3 CONFIG REQUIRED)

target_include_directories(main PRIVATE include)
target_link_libraries(main PRIVATE
    CURL::libcurl
    BZip2::BZip2
    GDAL::GDAL
    unofficial::sqlite3::sqlite3
)