#!/usr/bin/env python3
import argparse
from communication.telemetry_client import TelemetryClient

def main():
    parser = argparse.ArgumentParser(description='Update backend with drone telemetry')
    parser.add_argument('--drone', default='Drone1', help='Drone name')
    parser.add_argument('--backend', default='http://localhost:8000', help='Backend URL')
    parser.add_argument('--interval', type=float, default=1.0, help='Update interval in seconds')
    
    args = parser.parse_args()
    
    client = TelemetryClient(args.drone, args.backend, args.interval)
    client.start()
    
    print(f"Sending telemetry from {args.drone} every {args.interval}s")
    print("Press Ctrl+C to stop...")
    
    try:
        while True:
            pass
    except KeyboardInterrupt:
        client.stop()
        print("\nTelemetry updater stopped")

if __name__ == '__main__':
    main()