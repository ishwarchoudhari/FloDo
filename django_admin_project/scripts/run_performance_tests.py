import requests
import time
import statistics
import json
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin

class PerformanceTester:
    def __init__(self, base_url='http://localhost:8000'):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = {}

    def measure_page_load(self, path, auth_required=False):
        url = urljoin(self.base_url, path)
        start_time = time.time()
        response = self.session.get(url)
        load_time = time.time() - start_time
        
        return {
            'path': path,
            'status_code': response.status_code,
            'load_time': load_time,
            'content_length': len(response.content),
        }

    def run_load_test(self, path, num_requests=100, concurrent=10):
        with ThreadPoolExecutor(max_workers=concurrent) as executor:
            results = list(executor.map(
                lambda _: self.measure_page_load(path),
                range(num_requests)
            ))
        
        load_times = [r['load_time'] for r in results if r['status_code'] == 200]
        
        return {
            'path': path,
            'total_requests': num_requests,
            'successful_requests': len(load_times),
            'avg_load_time': statistics.mean(load_times),
            'median_load_time': statistics.median(load_times),
            'p95_load_time': statistics.quantiles(load_times, n=20)[-1],
            'min_load_time': min(load_times),
            'max_load_time': max(load_times)
        }

    def analyze_static_assets(self):
        """Analyze static asset loading times and sizes"""
        paths = [
            '/static/dist/css/app.min.css',
            '/static/dist/js/common.js',
            '/static/dist/js/dashboard.js',
        ]
        
        results = {}
        for path in paths:
            result = self.measure_page_load(path)
            results[path] = {
                'size_kb': result['content_length'] / 1024,
                'load_time': result['load_time']
            }
        
        return results

    def run_full_test_suite(self):
        """Run comprehensive performance tests"""
        # Test main pages
        pages = [
            '/',
            '/dashboard/',
            '/settings/',
            '/profile/',
        ]
        
        page_results = {}
        for page in pages:
            page_results[page] = self.run_load_test(page)
        
        # Test static assets
        asset_results = self.analyze_static_assets()
        
        # Save results
        results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'pages': page_results,
            'static_assets': asset_results
        }
        
        with open('performance_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        return results

if __name__ == '__main__':
    tester = PerformanceTester()
    results = tester.run_full_test_suite()
    print(json.dumps(results, indent=2))