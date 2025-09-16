// Frontend Performance Monitoring
const PerformanceMonitor = {
    metrics: {},
    
    init() {
        this.setupPerformanceObserver();
        this.setupNetworkMonitoring();
        this.setupErrorTracking();
        this.trackPageMetrics();
    },

    setupPerformanceObserver() {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.recordMetric('performance', {
                    name: entry.name,
                    duration: entry.duration,
                    startTime: entry.startTime,
                    entryType: entry.entryType
                });
            }
        });

        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input'] });
    },

    setupNetworkMonitoring() {
        if (window.performance && performance.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            resources.forEach(resource => {
                this.recordMetric('network', {
                    name: resource.name,
                    duration: resource.duration,
                    size: resource.transferSize,
                    type: resource.initiatorType
                });
            });
        }
    },

    setupErrorTracking() {
        window.addEventListener('error', (event) => {
            this.recordMetric('error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                timestamp: new Date().toISOString()
            });
        });
    },

    trackPageMetrics() {
        // Track page load metrics
        window.addEventListener('load', () => {
            const timing = performance.timing;
            const metrics = {
                pageLoad: timing.loadEventEnd - timing.navigationStart,
                domReady: timing.domComplete - timing.domLoading,
                networkLatency: timing.responseEnd - timing.requestStart,
                processingTime: timing.domComplete - timing.responseEnd,
                backendTime: timing.responseEnd - timing.requestStart
            };
            
            this.recordMetric('page', metrics);
        });
    },

    recordMetric(category, data) {
        if (!this.metrics[category]) {
            this.metrics[category] = [];
        }
        this.metrics[category].push({
            ...data,
            timestamp: new Date().toISOString()
        });

        // Send metrics to backend if threshold reached
        if (this.metrics[category].length >= 10) {
            this.sendMetricsToServer(category);
        }
    },

    async sendMetricsToServer(category) {
        try {
            const response = await fetch('/api/metrics/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify({
                    category,
                    metrics: this.metrics[category]
                })
            });

            if (response.ok) {
                // Clear sent metrics
                this.metrics[category] = [];
            }
        } catch (error) {
            console.error('Failed to send metrics:', error);
        }
    }
};

// Initialize performance monitoring
document.addEventListener('DOMContentLoaded', () => {
    PerformanceMonitor.init();
});