#!/usr/bin/env python3
"""
Character Image Downloader Script
Downloads and processes images of specified characters/people in uniform format
"""

import requests
import os
import time
from PIL import Image, ImageOps
import hashlib
from urllib.parse import urlparse, quote
import json
from datetime import datetime

class CharacterImageDownloader:
    def __init__(self, output_dir="character_images", image_size=(512, 512)):
        self.output_dir = output_dir
        self.image_size = image_size
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Lijst van karakters/personen
        self.characters = [
            "mario nintendo",
            "link zelda",
            "gandalf the grey",
            "pac-man",
            "vegeta dragon ball",
            "sailor moon",
            "dwayne johnson",
            "conan o'brien",
            "elon musk",
            "yoda star wars",
            "harry potter",
            "ghost rider marvel",
            "jean grey x-men",
            "abraham lincoln",
            "king arthur"
        ]
        
        self.setup_directories()
        
    def setup_directories(self):
        """Maak benodigde mappen aan"""
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(f"{self.output_dir}/raw", exist_ok=True)
        os.makedirs(f"{self.output_dir}/processed", exist_ok=True)
        
    def search_wikimedia_commons(self, query, limit=5):
        """Zoek afbeeldingen op Wikimedia Commons"""
        api_url = "https://commons.wikimedia.org/w/api.php"
        params = {
            'action': 'query',
            'format': 'json',
            'generator': 'search',
            'gsrnamespace': 6,  # File namespace
            'gsrsearch': f'filetype:bitmap {query}',
            'gsrlimit': limit,
            'prop': 'imageinfo',
            'iiprop': 'url|size|mime'
        }
        
        try:
            response = self.session.get(api_url, params=params)
            data = response.json()
            
            images = []
            if 'query' in data and 'pages' in data['query']:
                for page in data['query']['pages'].values():
                    if 'imageinfo' in page:
                        info = page['imageinfo'][0]
                        if info.get('mime', '').startswith('image/'):
                            images.append({
                                'url': info['url'],
                                'title': page['title'],
                                'size': (info.get('width', 0), info.get('height', 0))
                            })
            return images
        except Exception as e:
            print(f"Error searching Wikimedia for {query}: {e}")
            return []
    
    def search_bing_images(self, query, limit=5):
        """Zoek afbeeldingen via Bing (vereist API key)"""
        # Voor demonstratie - je hebt een Bing Search API key nodig
        # api_key = "YOUR_BING_API_KEY"
        # endpoint = "https://api.bing.microsoft.com/v7.0/images/search"
        
        # Placeholder voor Bing API implementatie
        print(f"Bing search voor '{query}' (API key vereist)")
        return []
    
    def download_image(self, url, filename):
        """Download een afbeelding"""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            with open(filename, 'wb') as f:
                f.write(response.content)
            return True
        except Exception as e:
            print(f"Error downloading {url}: {e}")
            return False
    
    def process_image(self, input_path, output_path):
        """Verwerk afbeelding naar uniform formaat"""
        try:
            with Image.open(input_path) as img:
                # Converteer naar RGB als nodig
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize met aspect ratio behoud + center crop
                img = ImageOps.fit(img, self.image_size, Image.Resampling.LANCZOS)
                
                # Sla op als JPEG met hoge kwaliteit
                img.save(output_path, 'JPEG', quality=95, optimize=True)
                return True
        except Exception as e:
            print(f"Error processing {input_path}: {e}")
            return False
    
    def get_image_hash(self, filepath):
        """Bereken hash van afbeelding voor deduplicatie"""
        try:
            with open(filepath, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except:
            return None
    
    def download_character_images(self, character_name, max_images=3):
        """Download afbeeldingen voor een specifiek karakter"""
        print(f"\n=== Downloading images for: {character_name} ===")
        
        # Maak character directory
        char_dir = character_name.replace(' ', '_').lower()
        raw_dir = f"{self.output_dir}/raw/{char_dir}"
        processed_dir = f"{self.output_dir}/processed/{char_dir}"
        os.makedirs(raw_dir, exist_ok=True)
        os.makedirs(processed_dir, exist_ok=True)
        
        downloaded_images = []
        image_hashes = set()
        
        # Zoek op Wikimedia Commons
        wikimedia_results = self.search_wikimedia_commons(character_name, limit=max_images * 2)
        
        for i, result in enumerate(wikimedia_results):
            if len(downloaded_images) >= max_images:
                break
                
            filename = f"{char_dir}_wikimedia_{i+1}.jpg"
            raw_path = f"{raw_dir}/{filename}"
            processed_path = f"{processed_dir}/{filename}"
            
            print(f"Downloading: {result['title']}")
            if self.download_image(result['url'], raw_path):
                # Check voor duplicaten
                img_hash = self.get_image_hash(raw_path)
                if img_hash and img_hash not in image_hashes:
                    image_hashes.add(img_hash)
                    
                    # Verwerk afbeelding
                    if self.process_image(raw_path, processed_path):
                        downloaded_images.append({
                            'source': 'wikimedia',
                            'original_url': result['url'],
                            'raw_path': raw_path,
                            'processed_path': processed_path,
                            'hash': img_hash
                        })
                        print(f"✓ Processed: {filename}")
                    else:
                        os.remove(raw_path)  # Verwijder als processing faalt
                else:
                    os.remove(raw_path)  # Verwijder duplicaat
            
            time.sleep(1)  # Rate limiting
        
        # Save metadata
        metadata = {
            'character': character_name,
            'download_date': datetime.now().isoformat(),
            'images': downloaded_images,
            'total_downloaded': len(downloaded_images)
        }
        
        with open(f"{processed_dir}/metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Downloaded {len(downloaded_images)} images for {character_name}")
        return downloaded_images
    
    def run(self):
        """Voer het complete download proces uit"""
        print("Starting Character Image Download Process")
        print(f"Output directory: {self.output_dir}")
        print(f"Target image size: {self.image_size}")
        
        all_results = {}
        
        for character in self.characters:
            try:
                results = self.download_character_images(character)
                all_results[character] = results
                time.sleep(2)  # Pauze tussen karakters
            except KeyboardInterrupt:
                print("\nProcess interrupted by user")
                break
            except Exception as e:
                print(f"Error processing {character}: {e}")
                continue
        
        # Save complete log
        log_data = {
            'download_session': datetime.now().isoformat(),
            'target_size': self.image_size,
            'results': all_results,
            'summary': {
                'total_characters': len(self.characters),
                'successful_downloads': sum(len(results) for results in all_results.values()),
                'characters_processed': len(all_results)
            }
        }
        
        with open(f"{self.output_dir}/download_log.json", 'w') as f:
            json.dump(log_data, f, indent=2)
        
        print(f"\n=== Download Complete ===")
        print(f"Total images downloaded: {log_data['summary']['successful_downloads']}")
        print(f"Characters processed: {log_data['summary']['characters_processed']}")
        print(f"Results saved to: {self.output_dir}")

def main():
    """Main function"""
    # Configuratie
    downloader = CharacterImageDownloader(
        output_dir="character_images",
        image_size=(512, 512)
    )
    
    # Start download proces
    downloader.run()

if __name__ == "__main__":
    # Installeer vereiste packages:
    # pip install requests pillow
    
    main()