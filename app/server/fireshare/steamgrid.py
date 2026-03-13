"""
SteamGridDB API Integration
Handles game search and asset retrieval from SteamGridDB API
"""
import requests
import logging
from typing import Optional, List, Dict
from pathlib import Path

logger = logging.getLogger(__name__)


class SteamGridDBClient:
    """Client for interacting with SteamGridDB API"""

    BASE_URL = "https://www.steamgriddb.com/api/v2"

    def __init__(self, api_key: str):
        """
        Initialize SteamGridDB client

        Args:
            api_key: SteamGridDB API key
        """
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}"
        }

    def search_games(self, query: str) -> List[Dict]:
        """
        Search for games by name

        Args:
            query: Game name to search for

        Returns:
            List of game dictionaries with id, name, release_date
        """
        try:
            url = f"{self.BASE_URL}/search/autocomplete/{query}"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()

            data = response.json()
            if data.get("success") and data.get("data"):
                return data["data"]
            return []

        except Exception as e:
            logger.error(f"Error searching SteamGridDB for '{query}': {e}")
            return []

    def get_game_by_id(self, game_id: int) -> Optional[Dict]:
        """
        Get game details by SteamGridDB game ID

        Args:
            game_id: SteamGridDB game ID

        Returns:
            Game dictionary or None
        """
        try:
            url = f"{self.BASE_URL}/games/id/{game_id}"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()

            data = response.json()
            if data.get("success") and data.get("data"):
                return data["data"]
            return None

        except Exception as e:
            logger.error(f"Error fetching game {game_id} from SteamGridDB: {e}")
            return None

    def get_heroes(self, game_id: int, limit: int = 1) -> List[Dict]:
        """
        Get hero images for a game

        Args:
            game_id: SteamGridDB game ID
            limit: Number of results to return

        Returns:
            List of hero image dictionaries
        """
        try:
            url = f"{self.BASE_URL}/heroes/game/{game_id}"
            params = {"dimensions": "1920x620,3840x1240"}  # Standard hero sizes
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            if data.get("success") and data.get("data"):
                return data["data"][:limit]
            return []

        except Exception as e:
            logger.error(f"Error fetching heroes for game {game_id}: {e}")
            return []

    def get_logos(self, game_id: int, limit: int = 1) -> List[Dict]:
        """
        Get logo images for a game

        Args:
            game_id: SteamGridDB game ID
            limit: Number of results to return

        Returns:
            List of logo image dictionaries
        """
        try:
            url = f"{self.BASE_URL}/logos/game/{game_id}"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()

            data = response.json()
            if data.get("success") and data.get("data"):
                return data["data"][:limit]
            return []

        except Exception as e:
            logger.error(f"Error fetching logos for game {game_id}: {e}")
            return []

    def get_icons(self, game_id: int, limit: int = 1) -> List[Dict]:
        """
        Get icon images for a game

        Args:
            game_id: SteamGridDB game ID
            limit: Number of results to return

        Returns:
            List of icon image dictionaries
        """
        try:
            url = f"{self.BASE_URL}/icons/game/{game_id}"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()

            data = response.json()
            if data.get("success") and data.get("data"):
                return data["data"][:limit]
            return []

        except Exception as e:
            logger.error(f"Error fetching icons for game {game_id}: {e}")
            return []

    def get_game_assets(self, game_id: int) -> Dict:
        """
        Get all assets for a game (hero, logo, icon)

        Args:
            game_id: SteamGridDB game ID

        Returns:
            Dictionary with hero_url, logo_url, icon_url
        """
        assets = {
            "hero_url": None,
            "logo_url": None,
            "icon_url": None
        }

        # Get hero
        heroes = self.get_heroes(game_id, limit=1)
        if heroes:
            assets["hero_url"] = heroes[0].get("url")

        # Get logo
        logos = self.get_logos(game_id, limit=1)
        if logos:
            assets["logo_url"] = logos[0].get("url")

        # Get icon
        icons = self.get_icons(game_id, limit=1)
        if icons:
            assets["icon_url"] = icons[0].get("url")

        return assets

    def _download_asset(self, url: str, save_path: Path) -> bool:
        """
        Download a single asset from URL to save_path

        Args:
            url: Asset URL to download
            save_path: Path to save the downloaded file

        Returns:
            True on success, False on failure
        """
        try:
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()

            # Write to file
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            logger.info(f"Downloaded asset to {save_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to download asset from {url}: {e}")
            return False

    def _get_extension_from_url(self, url: str) -> str:
        """
        Extract file extension from URL

        Args:
            url: Asset URL

        Returns:
            File extension (e.g., '.png', '.jpg', '.webp'), defaults to '.png'
        """
        # Try to get extension from URL
        if '.' in url:
            ext = '.' + url.split('.')[-1].split('?')[0].lower()
            if ext in ['.png', '.jpg', '.jpeg', '.webp']:
                return ext

        # Default to png
        return '.png'

    def download_and_save_assets(self, game_id: int, base_path: Path) -> Dict:
        """
        Download and save game assets locally

        Args:
            game_id: SteamGridDB game ID
            base_path: Base directory for game assets (e.g., /data/game_assets)

        Returns:
            Dictionary with success status and error details if failed
            {
                "success": True/False,
                "error": "error message if failed",
                "assets": {
                    "heroes": number downloaded,
                    "logos": number downloaded,
                    "icons": number downloaded
                }
            }
        """
        import tempfile
        import shutil

        # Create temp directory for downloads
        temp_dir = Path(tempfile.mkdtemp())

        try:
            # Fetch assets from API
            heroes = self.get_heroes(game_id, limit=2)
            logos = self.get_logos(game_id, limit=1)
            icons = self.get_icons(game_id, limit=1)

            # Download heroes (optional)
            hero_count = 0
            for i, hero in enumerate(heroes[:2], 1):
                url = hero.get("url")
                if url:
                    ext = self._get_extension_from_url(url)
                    temp_path = temp_dir / f"hero_{i}{ext}"
                    if self._download_asset(url, temp_path):
                        hero_count += 1
                    # Don't fail if hero download fails, it's optional

            # Download logo (optional)
            logo_count = 0
            if logos:
                url = logos[0].get("url")
                if url:
                    ext = self._get_extension_from_url(url)
                    temp_path = temp_dir / f"logo_1{ext}"
                    if self._download_asset(url, temp_path):
                        logo_count += 1
                    # Don't fail if logo download fails, it's optional

            # Download icon (optional)
            icon_count = 0
            if icons:
                url = icons[0].get("url")
                if url:
                    ext = self._get_extension_from_url(url)
                    temp_path = temp_dir / f"icon_1{ext}"
                    if self._download_asset(url, temp_path):
                        icon_count += 1
                    # Don't fail if icon download fails, it's optional

            # All downloads successful, move to final location
            final_dir = base_path / str(game_id)
            final_dir.mkdir(parents=True, exist_ok=True)

            # Move files from temp to final location
            for temp_file in temp_dir.iterdir():
                final_path = final_dir / temp_file.name
                shutil.move(str(temp_file), str(final_path))
                logger.info(f"Moved {temp_file.name} to {final_path}")

            logger.info(f"Successfully downloaded assets for game {game_id}: {hero_count} heroes, {logo_count} logos, {icon_count} icons")

            return {
                "success": True,
                "error": None,
                "assets": {
                    "heroes": hero_count,
                    "logos": logo_count,
                    "icons": icon_count
                }
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to download assets for game {game_id}: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "assets": {"heroes": 0, "logos": 0, "icons": 0}
            }

        finally:
            # Clean up temp directory
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
