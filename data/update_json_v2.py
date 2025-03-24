import json
import time
from argparse import ArgumentParser
from getpass import getpass

from github import Github, GithubException, RateLimitExceededException
from loguru import logger


def setup_logger():
    """Configure loguru logger with reasonable defaults."""
    logger.remove()  # Remove default handler
    logger.add(
        "github_updater.log",
        rotation="10 MB",
        retention="1 week",
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}"
    )
    logger.add(lambda msg: print(msg), level="INFO", format="{message}")


def extract_repo_path(github_url):
    """Extract owner/repo from a GitHub URL."""
    if not github_url.startswith("https://github.com/"):
        raise ValueError(f"Invalid GitHub URL: {github_url}")
    return github_url.replace("https://github.com/", "")


def update_repo_stats(g, repo_path, repo_data, max_retries=5):
    """Update repository stats with proper rate limit handling."""
    retry_count = 0
    backoff_time = 1

    while retry_count < max_retries:
        try:
            logger.debug(f"Fetching data for {repo_path}")
            github_repo = g.get_repo(repo_path)
            
            # Update repository data
            repo_data["stars_count"] = github_repo.stargazers_count
            repo_data["forks_count"] = github_repo.forks_count
            
            # Log rate limit information
            rate_limit = g.get_rate_limit().core
            logger.debug(f"Rate limit: {rate_limit.remaining}/{rate_limit.limit}, Reset at: {rate_limit.reset}")
            
            return True
            
        except RateLimitExceededException as e:
            reset_timestamp = g.get_rate_limit().core.reset.timestamp()
            wait_time = max(reset_timestamp - time.time(), 0) + 1
            logger.warning(f"Rate limit exceeded. Waiting for {wait_time:.0f} seconds until reset.")
            time.sleep(wait_time)
            
        except GithubException as e:
            logger.error(f"GitHub API error: {e.status} - {e.data.get('message', '')}")
            if e.status == 404:
                logger.error(f"Repository {repo_path} not found!")
                return False
                
            retry_count += 1
            backoff_time *= 2
            logger.warning(f"Retrying in {backoff_time} seconds... (Attempt {retry_count}/{max_retries})")
            time.sleep(backoff_time)
            
        except Exception as e:
            logger.exception(f"Unexpected error: {str(e)}")
            retry_count += 1
            backoff_time *= 2
            logger.warning(f"Retrying in {backoff_time} seconds... (Attempt {retry_count}/{max_retries})")
            time.sleep(backoff_time)
            
    logger.error(f"Failed to update {repo_path} after {max_retries} attempts")
    return False


def main():
    setup_logger()
    logger.info("Starting GitHub repository stats updater")
    
    parser = ArgumentParser(description="Update GitHub repository stats in a JSON file")
    parser.add_argument('json', help="Path to JSON file containing repository data")
    parser.add_argument('--token', help="GitHub personal access token (recommended instead of password)")
    parser.add_argument('--output', help="Optional output file (defaults to overwriting input file)")
    args = parser.parse_args()
    
    # Authentication - prefer token but fall back to username/password
    if args.token:
        logger.info("Using GitHub token for authentication")
        g = Github(args.token)
    else:
        logger.info("Token not provided, using username/password authentication")
        logger.warning("Username/password authentication is deprecated. Consider using a token instead.")
        username = input('Username: ')
        password = getpass('Password: ')
        g = Github(username, password)
    
    try:
        # Load JSON data
        logger.info(f"Loading repository data from {args.json}")
        with open(args.json) as f:
            data = json.load(f)
        
        # Process repositories
        total_repos = len(data)
        success_count = 0
        logger.info(f"Found {total_repos} repositories to update")
        
        for index, repo in enumerate(data, 1):
            repo_name = repo.get('name', f'Repository #{index}')
            logger.info(f"[{index}/{total_repos}] Processing {repo_name}...")
            
            try:
                # Extract GitHub URL
                github_url = next(iter(i['url'] for i in repo['links'] if 'github.com' in i['url']), None)
                if not github_url:
                    logger.error(f"No GitHub URL found for {repo_name}")
                    continue
                
                # Get repository path and update stats
                repo_path = extract_repo_path(github_url)
                logger.info(f"Updating stats for {repo_path}")
                
                # Before update
                before_stars = repo.get('stars_count', 'unknown')
                before_forks = repo.get('forks_count', 'unknown')
                
                # Update repository data
                if update_repo_stats(g, repo_path, repo):
                    # After update
                    logger.info(f"Updated {repo_name} - Stars: {before_stars} → {repo['stars_count']}, "
                                f"Forks: {before_forks} → {repo['forks_count']}")
                    success_count += 1
                
            except Exception as e:
                logger.exception(f"Error processing {repo_name}: {str(e)}")
        
        # Save updated data
        output_file = args.output or args.json
        logger.info(f"Saving updated data to {output_file}")
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.success(f"Successfully updated {success_count}/{total_repos} repositories")
        
    except Exception as e:
        logger.exception(f"Program failed: {str(e)}")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
