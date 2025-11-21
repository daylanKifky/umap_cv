#!/usr/bin/env python3
"""
Test script to validate the build output.
This runs on all branches to validate the build.
"""

import sys
import os
import re
import json
import argparse
from pathlib import Path
from typing import List, Set, Dict, Tuple


def test_article_files_exist(input_folder: Path, output_folder: Path) -> Tuple[bool, List[str]]:
    """
    Test that each markdown or HTML file starting with an integer in input
    has a corresponding HTML file in output.
    
    Args:
        input_folder: Path to input articles folder
        output_folder: Path to output public folder
        
    Returns:
        Tuple of (success, list of error messages)
    """
    print("\n📄 Testing article files...")
    errors = []
    
    if not input_folder.exists():
        errors.append(f"Input folder not found: {input_folder}")
        return False, errors
    
    # Find all markdown and HTML files starting with a digit
    md_files = sorted([f for f in input_folder.glob("*.md") if f.name[0].isdigit()])
    html_files = sorted([f for f in input_folder.glob("*.html") if f.name[0].isdigit()])
    
    input_files = md_files + html_files
    
    if not input_files:
        errors.append(f"No markdown or HTML files starting with a digit found in {input_folder}")
        return False, errors
    
    print(f"  Found {len(input_files)} article files in input ({len(md_files)} .md, {len(html_files)} .html)")
    
    # Check each has corresponding HTML in output
    for input_file in input_files:
        # Extract base name (e.g., "001_article.md" -> "001_article")
        base_name = input_file.stem
        output_html = output_folder / f"{base_name}.html"
        
        if output_html.exists():
            print(f"  ✓ {input_file.name} → {output_html.name}")
        else:
            errors.append(f"Missing HTML file for {input_file.name}: expected {output_html}")
            print(f"  ✗ {input_file.name} → {output_html.name} (missing)")
    
    success = len(errors) == 0
    if success:
        print(f"  ✅ All {len(input_files)} article files converted successfully")
    
    return success, errors


def test_local_images_exist(input_folder: Path, output_folder: Path, thumbnail_res: str = None) -> Tuple[bool, List[str]]:
    """
    Test that local images referenced in markdown files
    are present in the output folder's images directory,
    and that thumbnails with the specified resolution exist.
    
    Args:
        input_folder: Path to input articles folder
        output_folder: Path to output public folder
        thumbnail_res: Thumbnail resolution (e.g., '400x210')
        
    Returns:
        Tuple of (success, list of error messages)
    """
    print("\n🖼️  Testing local images...")
    errors = []
    
    if not input_folder.exists():
        errors.append(f"Input folder not found: {input_folder}")
        return False, errors
    
    images_output = output_folder / "images"
    
    # Find all markdown files
    md_files = list(input_folder.glob("*.md"))
    
    if not md_files:
        print("  ⚠️  No markdown files found, skipping image test")
        return True, []
    
    # Extract local image references from markdown files
    local_images: Set[str] = set()
    image_pattern = re.compile(r'!\[.*?\]\(([^)]+)\)')
    
    for md_file in md_files:
        content = md_file.read_text(encoding='utf-8')
        matches = image_pattern.findall(content)
        
        for match in matches:
            # Skip URLs (http/https)
            if match.startswith(('http://', 'https://')):
                continue
            
            # Extract filename from path
            filename = os.path.basename(match)
            local_images.add(filename)
    
    if not local_images:
        print("  ℹ️  No local images referenced in markdown files")
        return True, []
    
    print(f"  Found {len(local_images)} unique local image references")
    
    # Check each image exists in output
    for image_name in sorted(local_images):
        image_path = images_output / image_name
        
        if image_path.exists():
            print(f"  ✓ {image_name}")
        else:
            errors.append(f"Missing image: {image_name} (expected at {image_path})")
            print(f"  ✗ {image_name} (missing)")
    
    # Check thumbnails if thumbnail_res is specified
    if thumbnail_res:
        print(f"\n🖼️  Testing thumbnails (resolution: {thumbnail_res})...")
        
        for image_name in sorted(local_images):
            # Generate thumbnail filename
            # E.g., "image.jpg" -> "image_400x210.jpg"
            name_parts = image_name.rsplit('.', 1)
            if len(name_parts) == 2:
                thumbnail_name = f"{name_parts[0]}_{thumbnail_res}.{name_parts[1]}"
            else:
                thumbnail_name = f"{image_name}_{thumbnail_res}"
            
            thumbnail_path = images_output / thumbnail_name
            
            if thumbnail_path.exists():
                print(f"  ✓ {thumbnail_name}")
            else:
                errors.append(f"Missing thumbnail: {thumbnail_name} (expected at {thumbnail_path})")
                print(f"  ✗ {thumbnail_name} (missing)")
    
    success = len(errors) == 0
    if success:
        if thumbnail_res:
            print(f"  ✅ All {len(local_images)} images and thumbnails present")
        else:
            print(f"  ✅ All {len(local_images)} images present")
    
    return success, errors


def test_no_duplicate_indices(output_folder: Path) -> Tuple[bool, List[str]]:
    """
    Test that no duplicate article indices exist in the output HTML files.
    
    Args:
        output_folder: Path to output public folder
        
    Returns:
        Tuple of (success, list of error messages)
    """
    print("\n🔢 Testing for duplicate indices...")
    errors = []
    
    # Find all HTML files starting with a digit
    html_files = sorted([f for f in output_folder.glob("*.html") if f.name[0].isdigit()])
    
    if not html_files:
        print("  ⚠️  No article HTML files found")
        return True, []
    
    print(f"  Found {len(html_files)} article HTML files")
    
    # Extract indices from filenames (first 3 digits)
    indices: Dict[str, List[str]] = {}
    
    for html_file in html_files:
        # Extract index (e.g., "001_article.html" -> "001")
        match = re.match(r'^(\d{3})', html_file.name)
        if match:
            index = match.group(1)
            if index not in indices:
                indices[index] = []
            indices[index].append(html_file.name)
    
    # Check for duplicates
    duplicates = {idx: files for idx, files in indices.items() if len(files) > 1}
    
    if duplicates:
        for index, files in duplicates.items():
            error_msg = f"Duplicate index {index} found in files: {', '.join(files)}"
            errors.append(error_msg)
            print(f"  ✗ {error_msg}")
    else:
        print(f"  ✓ All {len(indices)} indices are unique")
        print(f"  ✅ No duplicate indices found")
    
    return len(errors) == 0, errors


def test_embeddings_file(output_folder: Path) -> Tuple[bool, List[str]]:
    """
    Test that the embeddings file specified in conf.js exists
    and has exactly one entry for each article.
    
    Args:
        output_folder: Path to output public folder
        
    Returns:
        Tuple of (success, list of error messages)
    """
    print("\n📊 Testing embeddings file...")
    errors = []
    
    # Read conf.js to find embeddings filename
    conf_js_path = output_folder / "conf.js"
    
    if not conf_js_path.exists():
        errors.append(f"conf.js not found at {conf_js_path}")
        return False, errors
    
    conf_content = conf_js_path.read_text(encoding='utf-8')
    
    # Extract EMBEDDINGS_FILE constant
    match = re.search(r'const\s+EMBEDDINGS_FILE\s*=\s*["\']([^"\']+)["\']', conf_content)
    
    if not match:
        errors.append("EMBEDDINGS_FILE constant not found in conf.js")
        return False, errors
    
    embeddings_filename = match.group(1)
    print(f"  Found embeddings file reference: {embeddings_filename}")
    
    # Check if embeddings file exists
    embeddings_path = output_folder / embeddings_filename
    
    if not embeddings_path.exists():
        errors.append(f"Embeddings file not found: {embeddings_filename}")
        print(f"  ✗ {embeddings_filename} (missing)")
        return False, errors
    
    print(f"  ✓ {embeddings_filename} exists")
    
    # Load embeddings JSON
    try:
        with open(embeddings_path, 'r', encoding='utf-8') as f:
            embeddings_data = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"Invalid JSON in embeddings file: {e}")
        return False, errors
    
    # Count article HTML files (only those with integer ID pattern like 001_, 002_, etc.)
    article_files = sorted([f for f in output_folder.glob("*.html") if re.match(r'^\d{3}_', f.name)])
    num_articles = len(article_files)
    
    print(f"  Found {num_articles} article HTML files")
    
    # Count embeddings entries (assuming top-level keys are article IDs)
    num_embeddings = len(embeddings_data["articles"])
    print(f"  Found {num_embeddings} embeddings entries")
    
    # Check if counts match
    if num_embeddings == num_articles:
        print(f"  ✓ Embeddings count matches article count")
        print(f"  ✅ Embeddings file valid")
        return True, []
    else:
        error_msg = f"Embeddings count mismatch: {num_embeddings} embeddings vs {num_articles} articles"
        errors.append(error_msg)
        print(f"  ✗ {error_msg}")
        return False, errors


def run_tests(input_folder: Path, output_folder: Path, thumbnail_res: str = None) -> int:
    """
    Run all tests and return exit code.
    
    Args:
        input_folder: Path to input articles folder
        output_folder: Path to output public folder
        thumbnail_res: Thumbnail resolution (e.g., '400x210')
        
    Returns:
        Exit code (0 = success, 1 = failure)
    """
    print("=" * 70)
    print("Running Build Validation Tests")
    print("=" * 70)
    print(f"Input folder:  {input_folder}")
    print(f"Output folder: {output_folder}")
    if thumbnail_res:
        print(f"Thumbnail res: {thumbnail_res}")
    
    # Check that output directory exists
    if not output_folder.exists():
        print(f"\n✗ Output directory not found: {output_folder}")
        return 1
    
    # Run all tests
    all_errors = []
    
    # Test 1: Article files
    success1, errors1 = test_article_files_exist(input_folder, output_folder)
    all_errors.extend(errors1)
    
    # Test 2: Local images
    success2, errors2 = test_local_images_exist(input_folder, output_folder, thumbnail_res)
    all_errors.extend(errors2)
    
    # Test 3: No duplicate indices
    success3, errors3 = test_no_duplicate_indices(output_folder)
    all_errors.extend(errors3)
    
    # Test 4: Embeddings file
    success4, errors4 = test_embeddings_file(output_folder)
    all_errors.extend(errors4)
    
    # Summary
    print("\n" + "=" * 70)
    if all_errors:
        print("❌ Tests Failed!")
        print("=" * 70)
        print("\nErrors:")
        for i, error in enumerate(all_errors, 1):
            print(f"  {i}. {error}")
        return 1
    else:
        print("✅ All Tests Passed!")
        print("=" * 70)
        return 0


def main():
    """Main entrypoint for command-line interface"""
    parser = argparse.ArgumentParser(
        description='Test build output validity',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    # Calculate default paths relative to this file
    script_dir = Path(__file__).parent
    default_input = str(script_dir / 'sample_articles')
    default_output = str(script_dir / 'public')
    
    parser.add_argument(
        '--input', '-i',
        type=str,
        default=default_input,
        help=f'Input folder containing markdown files (default: {default_input})'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        default=default_output,
        help=f'Output directory to test (default: {default_output})'
    )
    
    parser.add_argument(
        '--thumbnail-res',
        type=str,
        default='400x210',
        help='Thumbnail resolution in format WIDTHxHEIGHT (default: 400x210)'
    )
    
    args = parser.parse_args()
    
    input_folder = Path(args.input)
    output_folder = Path(args.output)
    
    return run_tests(input_folder, output_folder, args.thumbnail_res)


if __name__ == "__main__":
    sys.exit(main())

