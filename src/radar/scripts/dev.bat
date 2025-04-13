@echo off
if exist build (
    rmdir /s /q build
)
cmake -B build -S . -G "MinGW Makefiles" ^
 -DCMAKE_TOOLCHAIN_FILE=C:/Users/aidan/vcpkg/scripts/buildsystems/vcpkg.cmake ^
 -DVCPKG_TARGET_TRIPLET=x64-mingw-dynamic ^
 -DCMAKE_BUILD_TYPE=Release

cmake --build build
build\main.exe
