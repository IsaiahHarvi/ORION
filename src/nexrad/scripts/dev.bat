@echo off
if exist build (
    rmdir /s /q build
)
cmake -B build -S . -G "Visual Studio 17 2022" -A x64 ^
 -DCMAKE_TOOLCHAIN_FILE=C:/Users/aidan/vcpkg/scripts/buildsystems/vcpkg.cmake ^
 -DVCPKG_TARGET_TRIPLET=x64-windows ^
 -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release
build\Release\main.exe
