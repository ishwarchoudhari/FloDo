"""Performance testing suite for FloDo application."""
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time
import statistics
import json
from urllib.parse import urljoin
import logging
import socket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PerformanceTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        
        # Print debug info
        logger.info(f"Testing connection to {self.base_url}")
        
        # Test if server is accessible
        try:
            response = self.session.get(self.base_url)
            logger.info(f"Server is accessible. Response status: {response.status_code}")
        except Exception as e:
            logger.error(f"Could not connect to server: {str(e)}")
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=5,  # Increased retries
            backoff_factor=0.1,  # Shorter waits between retries
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "OPTIONS"]  # Allow all methods we use
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Configure default headers
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        self.results = {}
        
    def login(self, username="admin", password="admin"):
        """Login to get session cookie."""
        login_url = urljoin(self.base_url, "Super-Admin/auth/login/")
        try:
            # Get CSRF token first
            response = self.session.get(login_url)
            logger.info(f"Login page status: {response.status_code}")
            
            if response.status_code == 200:
                # Extract CSRF token from the response cookies
                csrf_token = self.session.cookies.get('csrftoken')
                logger.info(f"Got CSRF token: {csrf_token}")
                
                if csrf_token:
                    login_data = {
                        'username': username,
                        'password': password,
                        'csrfmiddlewaretoken': csrf_token
                    }
                    headers = {
                        'Referer': login_url,
                        'X-CSRFToken': csrf_token,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                    response = self.session.post(
                        urljoin(self.base_url, "login/"),  # The actual login endpoint
                        data=login_data,
                        headers=headers,
                        allow_redirects=True
                    )
                    logger.info(f"Login response status: {response.status_code}")
                    return response.status_code == 200 or response.status_code == 302
            return False
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            return False

    def test_endpoint(self, path, method="GET", data=None):
        """Test a single endpoint's performance."""
        url = urljoin(self.base_url, path)
        logger.info(f"Testing endpoint: {url} [{method}]")
        start_time = time.time()
        
        try:
            headers = {
                'User-Agent': 'FloDo-Performance-Tester/1.0',
                'Accept': 'text/html,application/json',
                'Connection': 'keep-alive'
            }
            
            if method == "GET":
                logger.info(f"Sending GET request to {url}")
                response = self.session.get(url, headers=headers, timeout=10)
            else:
                csrf_token = self.session.cookies.get('csrftoken')
                headers.update({
                    'X-CSRFToken': csrf_token,
                    'Referer': url,
                    'Content-Type': 'application/json'
                })
                logger.info(f"Sending POST request to {url} with CSRF token: {csrf_token}")
                response = self.session.post(url, json=data, headers=headers, timeout=10)
                
            duration = time.time() - start_time
            
            return {
                "path": path,
                "method": method,
                "status_code": response.status_code,
                "duration": duration,
                "size": len(response.content),
                "is_success": 200 <= response.status_code < 400
            }
        except Exception as e:
            logger.error(f"Error testing {path}: {str(e)}")
            return {
                "path": path,
                "method": method,
                "error": str(e),
                "is_success": False
            }

    def load_test(self, path, concurrent_users=10, requests_per_user=10):
        """Perform load testing on an endpoint."""
        total_requests = concurrent_users * requests_per_user
        results = []
        
        def make_requests():
            return [self.test_endpoint(path) for _ in range(requests_per_user)]
        
        results = []
        for _ in range(concurrent_users):
            results.extend(make_requests())
        
        successful_results = [r for r in results if r.get("is_success", False)]
        if successful_results:
            durations = [r["duration"] for r in successful_results]
            
            return {
                "path": path,
                "total_requests": total_requests,
                "successful_requests": len(successful_results),
                "avg_response_time": statistics.mean(durations),
                "median_response_time": statistics.median(durations),
                "p95_response_time": statistics.quantiles(durations, n=20)[-1] if len(durations) >= 20 else max(durations),
                "min_response_time": min(durations),
                "max_response_time": max(durations)
            }
        return {
            "path": path,
            "total_requests": total_requests,
            "successful_requests": 0,
            "error": "No successful requests"
        }

    def run_full_test_suite(self):
        """Run comprehensive performance tests."""
        test_paths = [
            "Super-Admin/",  # Root admin path
            "Super-Admin/auth/login/",
            "Super-Admin/dashboard/",
            "Super-Admin/tables/",
            "Super-Admin/artist-applications/",
            "Super-Admin/clients/",
            "Super-Admin/Admin_management/",
            "Super-Admin/settings/",
            "Super-Admin/auth/profile/",
            "dashboard/api/admins/",  # API endpoints
            "dashboard/api/logs/",
            "dashboard/api/clients/",
            "dashboard/api/table/2/",
        ]
        
        logger.info("Starting full test suite...")
        
        # Try to login first
        if not self.login():
            logger.error("Login failed, some tests may not work correctly")
        
        # Single endpoint tests
        for path in test_paths:
            logger.info(f"Testing endpoint: {path}")
            result = self.test_endpoint(path)
            self.results[f"single_{path}"] = result
            
            if result.get("is_success", False):
                logger.info(f"Endpoint {path}: {result['duration']:.3f}s")
            else:
                logger.error(f"Endpoint {path} failed: {result.get('error', 'Unknown error')}")
        
        # Load tests for successful endpoints
        successful_paths = [
            p for p in test_paths 
            if self.results[f"single_{p}"].get("is_success", False)
        ]
        
        for path in successful_paths:
            logger.info(f"Running load test for: {path}")
            result = self.load_test(path)
            self.results[f"load_{path}"] = result
            
            if "error" not in result:
                logger.info(
                    f"Load test {path}:\n"
                    f"  Successful requests: {result['successful_requests']}/{result['total_requests']}\n"
                    f"  Average response time: {result['avg_response_time']:.3f}s\n"
                    f"  P95 response time: {result['p95_response_time']:.3f}s\n"
                    f"  Min/Max response time: {result['min_response_time']:.3f}s/{result['max_response_time']:.3f}s"
                )
            else:
                logger.error(f"Load test failed for {path}: {result['error']}")
        
        return self.results

    def save_results(self, filename="performance_test_results.json"):
        """Save test results to file."""
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        logger.info(f"Results saved to {filename}")

if __name__ == "__main__":
    tester = PerformanceTester()
    results = tester.run_full_test_suite()
    tester.save_results()