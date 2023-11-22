#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cd ..

echo "Installing from lockfile"
yarn --non-interactive --frozen-lockfile

echo "Outputting build to $PWD/build.cli"
rm -rf build.cli
mkdir build.cli

echo "Packing CLI"
yarn build
yarn pack -f ./build.cli/packaged.tar.gz

cd build.cli
tar zxvf packaged.tar.gz
cd package

echo "Copying build"
cp -R ../../build ./

echo "Copying node_modules"
cp -R ../../node_modules ./

echo ""
if ! ./bin/run --version > /dev/null; then
    echo "Failed to build ironfish-bridge-cli"
else
    echo "ironfish-bridge-cli built successfully"
fi

echo "Packaging build into ironfish-bridge-cli.tar.gz"
cd ..
mv package ironfish-bridge-cli
tar -cf ironfish-bridge-cli.tar.gz ironfish-bridge-cli
