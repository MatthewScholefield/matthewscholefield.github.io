#!/usr/bin/env python3
import json
import argparse
import sys
from typing import List, Dict, Any


def merge_projects(input_files: List[str]) -> List[Dict[str, Any]]:
    """
    Merge multiple project JSON files, keeping the entries with the highest stars_count
    for projects with the same name.
    
    Args:
        input_files: List of paths to JSON files to merge
        
    Returns:
        A list of merged project entries
    """
    # Dictionary to hold projects by name, with the highest stars_count
    merged_projects = {}
    
    for file_path in input_files:
        try:
            with open(file_path, 'r') as f:
                try:
                    projects = json.load(f)
                    
                    # Validate that the input is a list
                    if not isinstance(projects, list):
                        print(f"Error: {file_path} does not contain a JSON array at the top level", file=sys.stderr)
                        continue
                    
                    # Process each project in the current file
                    for project in projects:
                        # Validate project has required fields
                        if not isinstance(project, dict) or 'name' not in project or 'stars_count' not in project:
                            print(f"Warning: Skipping invalid project entry in {file_path}", file=sys.stderr)
                            continue
                        
                        name = project['name']
                        stars_count = project['stars_count']
                        
                        # Check if we've seen this project before
                        if name in merged_projects:
                            # Keep the entry with the higher stars_count
                            if stars_count > merged_projects[name]['stars_count']:
                                merged_projects[name] = project
                        else:
                            # First time seeing this project
                            merged_projects[name] = project
                            
                except json.JSONDecodeError:
                    print(f"Error: {file_path} is not a valid JSON file", file=sys.stderr)
        except IOError:
            print(f"Error: Could not open file {file_path}", file=sys.stderr)
    
    # Convert the dictionary back to a list
    return list(merged_projects.values())


def main():
    parser = argparse.ArgumentParser(description="Merge multiple project JSON files")
    parser.add_argument(
        "input_files", 
        nargs="+", 
        help="One or more input JSON files containing project arrays"
    )
    parser.add_argument(
        "-o", 
        "--output", 
        default="projects.json",
        help="Output file path (default: projects.json)"
    )
    
    args = parser.parse_args()
    
    # Merge the projects
    merged_projects = merge_projects(args.input_files)
    
    # Write the merged projects to the output file
    try:
        with open(args.output, 'w') as f:
            json.dump(merged_projects, f, indent=2)
        print(f"Successfully merged {len(merged_projects)} projects into {args.output}")
    except IOError:
        print(f"Error: Could not write to file {args.output}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
