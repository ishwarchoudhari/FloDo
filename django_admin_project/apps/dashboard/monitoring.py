from functools import wraps
import time
import logging
from django.db import connection
from django.conf import settings
import cProfile
import pstats
import io

logger = logging.getLogger('performance')

def performance_monitor(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Start timing and query count
        start_time = time.time()
        start_queries = len(connection.queries)
        
        # Profile the view
        profiler = cProfile.Profile()
        profiler.enable()
        
        # Execute view
        response = view_func(request, *args, **kwargs)
        
        # Stop profiling
        profiler.disable()
        
        # Calculate metrics
        end_time = time.time()
        end_queries = len(connection.queries)
        
        # Log performance data
        duration = end_time - start_time
        num_queries = end_queries - start_queries
        
        # Get profiling stats
        s = io.StringIO()
        stats = pstats.Stats(profiler, stream=s).sort_stats('cumulative')
        stats.print_stats(20)  # Top 20 time-consuming functions
        
        # Log performance metrics
        logger.info({
            'path': request.path,
            'method': request.method,
            'duration': duration,
            'num_queries': num_queries,
            'user': request.user.username if request.user.is_authenticated else 'anonymous',
            'profile': s.getvalue()
        })
        
        return response
    return wrapper