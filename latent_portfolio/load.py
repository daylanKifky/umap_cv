
import re
import markdown
from lxml import html, etree
import json
import os
from typing import Dict
from .utils import handle_image


def apply_base_url(path: str, base_url: str) -> str:
    """
    Apply base_url to a path if base_url is set and path is not already a full URL.
    
    Args:
        path: Path to apply base_url to
        base_url: Base URL (normalized, ends with / or empty)
        
    Returns:
        Path with base_url prepended if applicable
    """
    if not base_url or not path:
        return path
    
    # Don't modify full URLs (http/https)
    if path.startswith(('http://', 'https://')):
        return path
    
    # Remove leading slash from path if it exists (base_url already ends with /)
    path = path.lstrip('/')
    return base_url + path


def load_markdown_files(input_folder: str, output_folder: str = None, skip_confirmation: bool = False, base_url: str = "", thumbnail_res: str = '400x210') -> Dict[str, Dict]:
    """
    Load markdown files from a folder, convert to HTML, extract metadata and content.

    Args:
        input_folder: Path to folder containing markdown files
        output_folder: Path to folder where HTML files will be saved (optional)
        skip_confirmation: Skip confirmation prompts
        base_url: Base URL for paths
        thumbnail_res: Thumbnail resolution in format WIDTHxHEIGHT (default: '400x210')

    Returns:
        Dictionary with filename as key and parsed data as value
    """
    data = {}

    # Get all .md and .html files in the folder
    md_files = [f for f in os.listdir(input_folder) if f.endswith('.md') or f.endswith('.html')]

    n = len(md_files)
    total_combinations = (n * (n-1)) // 2
    if total_combinations > 1000:
        print(f"Found {n} markdown files.")
        print(f"This script will calculate {total_combinations} combinations for cross similarity.")
        print("This might take a while, and the frontend performance will be affected.")
        if not skip_confirmation:
            print("Do you want to continue? (y/n)")
            answer = input()
            if answer != 'y':
                return data
            exit()
    
    md_files.sort()  # Sort for consistent ordering

    # Create output folder if specified
    if output_folder:
        os.makedirs(output_folder, exist_ok=True)

    for filename in md_files:
        search = re.search(r'^(\d+)[_-].*\.(md|html)$', filename)
        if not search:
            print(f"\n> Warning: Could not find file ID in {filename}")
            continue
        article_id = int(search.group(1))
        file_extension = search.group(2)

        filepath = os.path.join(input_folder, filename)

        print(f"\n> Processing {filename}...")

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                file_contents = f.read()

            if file_extension == 'md':
                # Convert markdown to HTML
                html_content = markdown.markdown(file_contents)
            if file_extension == 'html':
                html_content = file_contents

            # Parse HTML to extract structured data FIRST (before applying base_url)
            try:
                # Parse HTML with lxml (handles malformed HTML)
                root = html.fromstring(f'<root>{html_content}</root>')

                # Extract first h1 tag as title
                h1_elem = root.find('.//h1')
                title = h1_elem.text.strip() if h1_elem is not None and h1_elem.text else None

                # Extract first p tag as content
                p_elem = root.find('.//p')
                content = p_elem.text.strip() if p_elem is not None and p_elem.text else None

                # Find all <img> tags and collect their src attributes (except the first one)
                other_img_elems = root.findall('.//img')
                # Skip the first (already in first_image_src), then extract src from the rest
                first_image_src = None
                other_image_srcs = []
                for i, elem in enumerate(other_img_elems):
                    if i == 0:
                        first_image_src = elem.get('src')
                    else:
                        other_image_srcs.append(elem.get('src'))
                other_image_srcs = list(set(other_image_srcs))

                # Extract JSON script data
                script_elem = root.find('.//script[@type="application/json"]')
                json_data = {}
                if script_elem is not None and script_elem.text:
                    try:
                        json_data = json.loads(script_elem.text.strip())
                    except json.JSONDecodeError as e:
                        print(f"\n\tWarning: Could not parse JSON in {filename}: {e}")


                # Validate JSON data
                required_keys = set(['technologies', 'description', 'tags'])
                if not required_keys <= set(json_data.keys()) :
                    print(f"\n\tWarning: JSON data in {filename} is not valid")
                    raise ValueError(f"JSON data in {filename} Should contain {required_keys} keys")

                if len(json_data['tags']) < 2:
                    raise ValueError(f"JSON data [tags] in {filename} Should contain at least 2 tags")

                if len(json_data['technologies']) < 2:
                    raise ValueError(f"JSON data [technologies] in {filename} Should contain at least 2 technologies")

                key = os.path.splitext(filename)[0]
                data[key] = {
                    'id': article_id,
                    'title': title,
                    'content': content,
                    'html_content': html_content,
                    'first_image_src': first_image_src
                }

                # Add JSON data to the result
                json_data['id'] = article_id
                data[key].update(json_data)

                # Handle image copying if output folder is specified
                if output_folder:
                    image_result = None

                    # Check precedence: thumbnail field in JSON first, then first image tag
                    # Skip if thumbnail is False, None, or empty string
                    if 'thumbnail' in json_data and json_data['thumbnail'] and json_data['thumbnail'] is not False:
                        image_source = json_data['thumbnail']
                        image_result = handle_image(image_source, output_folder, input_folder, thumbnail_res)
                        handle_image(first_image_src, output_folder, input_folder, None)
                    elif first_image_src:
                        image_result = handle_image(first_image_src, output_folder, input_folder, thumbnail_res)

                    print(f"\tProcessed first image: {image_result if image_result else 'NOT FOUND'}")
                    
                    for image_src in other_image_srcs:
                        handle_image(image_src, output_folder, input_folder, None)
                        print(f"\tProcessed other image: {image_result if image_result else 'NOT FOUND'}")

                    
                    # Handle different return types from handle_image
                    if image_result is False:
                        # Image not found
                        data[key]['thumbnail'] = False
                        data[key]['image'] = False
                    elif isinstance(image_result, str):
                        # Remote URL - use for both thumbnail and image
                        data[key]['thumbnail'] = image_result
                        data[key]['image'] = image_result
                    elif isinstance(image_result, dict):
                        # Local image with thumbnail and original paths
                        thumbnail_path = image_result.get('thumbnail')
                        image_path = image_result.get('image')
                        
                        # Apply base_url to paths if they are strings
                        if thumbnail_path and isinstance(thumbnail_path, str):
                            data[key]['thumbnail'] = apply_base_url(thumbnail_path, base_url)
                        else:
                            data[key]['thumbnail'] = False
                        
                        if image_path and isinstance(image_path, str):
                            data[key]['image'] = apply_base_url(image_path, base_url)
                        else:
                            data[key]['image'] = False
                    else:
                        # Fallback
                        data[key]['thumbnail'] = False
                        data[key]['image'] = False

                # Save HTML file if output folder specified
                if output_folder:
                    html_filename = filename.replace('.md', '.html')
                    html_filepath = os.path.join(output_folder, html_filename)
                    
                    # Apply base_url to image src attributes in HTML before saving
                    html_content_to_save = html_content
                    if base_url:
                        # Use regex to find and replace img src attributes
                        def replace_img_src(match):
                            src_value = match.group(1)
                            # Don't modify full URLs
                            if not src_value.startswith(('http://', 'https://')):
                                src_value = apply_base_url(src_value, base_url)
                            return f'src="{src_value}"'
                        
                        html_content_to_save = re.sub(r'src="([^"]+)"', replace_img_src, html_content)
                    

                    # Write the HTML file with base_url applied
                    with open(html_filepath, 'w', encoding='utf-8') as f:
                        f.write(html_content_to_save)
                    data[key]['html_filepath'] = apply_base_url(html_filename, base_url)
                    print(f"\tSaved HTML: {html_filepath}")

            except (etree.ParserError, etree.XMLSyntaxError, TypeError) as e:
                print(f"Error: Could not parse HTML in {filename}: {e}")
                continue

        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print(f"\nLoaded {len(data)} articles from {input_folder}")
    return data
