#!/bin/bash
# fair warning chatgpt made this

if [ -d "build" ]; then
    rm -rf build
fi

cmake -B build -S . -G "Ninja" \
  -DCMAKE_TOOLCHAIN_FILE=/c/Users/aidan/vcpkg/scripts/buildsystems/vcpkg.cmake \
  -DVCPKG_TARGET_TRIPLET=x64-windows \
  -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release
./build/Release/main.exe
