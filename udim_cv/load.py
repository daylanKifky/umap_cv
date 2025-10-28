
import re
import markdown
import xml.etree.ElementTree as ET
import json
import os
from typing import Dict
from .utils import handle_image

def load_markdown_files(input_folder: str, output_folder: str = None, skip_confirmation: bool = False) -> Dict[str, Dict]:
    """
    Load markdown files from a folder, convert to HTML, extract metadata and content.

    Args:
        input_folder: Path to folder containing markdown files
        output_folder: Path to folder where HTML files will be saved (optional)

    Returns:
        Dictionary with filename as key and parsed data as value
    """
    data = {}

    # Get all .md files in the folder
    md_files = [f for f in os.listdir(input_folder) if f.endswith('.md')]

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
        search = re.search(r'^(\d+)[_-].*\.md$', filename)
        if not search:
            print(f"Warning: Could not find file ID in {filename}")
            continue
        article_id = int(search.group(1))

        filepath = os.path.join(input_folder, filename)

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                markdown_content = f.read()

            # Convert markdown to HTML
            html_content = markdown.markdown(markdown_content)

            # Parse HTML to extract structured data
            try:
                # Parse HTML with XML parser
                root = ET.fromstring(f'<root>{html_content}</root>')

                # Extract first h1 tag as title
                h1_elem = root.find('.//h1')
                title = h1_elem.text.strip() if h1_elem is not None and h1_elem.text else None

                # Extract first p tag as content
                p_elem = root.find('.//p')
                content = p_elem.text.strip() if p_elem is not None and p_elem.text else None

                # Extract first img tag for image source
                img_elem = root.find('.//img')
                first_image_src = img_elem.get('src') if img_elem is not None else None

                # Extract JSON script data
                script_elem = root.find('.//script[@type="application/json"]')
                json_data = {}
                if script_elem is not None and script_elem.text:
                    try:
                        json_data = json.loads(script_elem.text.strip())
                    except json.JSONDecodeError as e:
                        print(f"Warning: Could not parse JSON in {filename}: {e}")

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
                    image_path = ''

                    # Check precedence: thumbnail field in JSON first, then first image tag
                    if 'thumbnail' in json_data and json_data['thumbnail']:
                        image_path = handle_image(json_data['thumbnail'], output_folder, input_folder)
                    elif first_image_src:
                        image_path = handle_image(first_image_src, output_folder, input_folder)

                    print(f"Processed image for {filename}: {image_path if image_path else 'NOT FOUND'}")
                    
                    data[key]['thumbnail'] = image_path

                # Save HTML file if output folder specified
                if output_folder:
                    html_filename = filename.replace('.md', '.html')
                    html_filepath = os.path.join(output_folder, html_filename)
                    with open(html_filepath, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    # Store relative path (just the filename)
                    data[key]['html_filepath'] = html_filename
                    print(f"Saved HTML: {html_filepath}")

            except ET.ParseError as e:
                print(f"Error: Could not parse HTML in {filename}: {e}")
                continue

        except Exception as e:
            print(f"Error reading {filename}: {e}")

    print(f"Loaded {len(data)} articles from {input_folder}")
    return data
