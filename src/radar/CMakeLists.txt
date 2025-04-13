cmake_minimum_required(VERSION 3.21)
project(RadarDownloader)

set(CMAKE_CXX_STANDARD 17)

# Tell CMake to use vcpkg toolchain
# Only needed when configuring with -DCMAKE_TOOLCHAIN_FILE
# set(CMAKE_TOOLCHAIN_FILE "C:/Users/aidan/vcpkg/scripts/buildsystems/vcpkg.cmake")

# Add your source files
file(GLOB SRC_FILES "src/*.cpp")

add_executable(main ${SRC_FILES})

# Link curl and bzip2 from vcpkg
find_package(CURL REQUIRED)
find_package(BZip2 REQUIRED)

target_include_directories(main PRIVATE include)
target_link_libraries(main PRIVATE CURL::libcurl BZip2::BZip2)
