#!/usr/bin/env python3
import argparse
from vision.video_streamer import VideoStreamer

def main():
    parser = argparse.ArgumentParser(description='Stream drone video to backend')
    parser.add_argument('--drone', default='Drone1', help='Drone name')
    parser.add_argument('--backend', default='http://localhost:8000', help='Backend URL')
    parser.add_argument('--incident', required=True, help='Incident ID')
    
    args = parser.parse_args()
    
    streamer = VideoStreamer(args.drone, args.backend, args.incident)
    streamer.start_stream()
    
    print(f"Streaming from {args.drone} to incident {args.incident}")
    print("Press Ctrl+C to stop...")
    
    try:
        while True:
            pass
    except KeyboardInterrupt:
        streamer.stop()
        print("\nStreaming stopped")

if __name__ == '__main__':
    main()