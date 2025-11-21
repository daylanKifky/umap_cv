#!/usr/bin/env python3
"""
Placeholder test script for non-public branches.
This runs on master and dev branches to validate the build.
"""

import sys
import os


def main():
    print("=" * 60)
    print("Running tests for non-public branch")
    print("=" * 60)
    
    # Check that build was successful
    if os.path.exists("public"):
        print("✓ Build output directory 'public' exists")
    else:
        print("✗ Build output directory 'public' not found")
        return 1
    
    # Check for essential files
    essential_files = ["public/index.html"]
    all_found = True
    
    for file_path in essential_files:
        if os.path.exists(file_path):
            print(f"✓ Found {file_path}")
        else:
            print(f"✗ Missing {file_path}")
            all_found = False
    
    if all_found:
        print("\n" + "=" * 60)
        print("All tests passed! ✓")
        print("=" * 60)
        return 0
    else:
        print("\n" + "=" * 60)
        print("Some tests failed! ✗")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())

