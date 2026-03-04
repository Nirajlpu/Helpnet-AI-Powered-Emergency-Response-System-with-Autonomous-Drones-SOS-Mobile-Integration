#!/usr/bin/env python3
import argparse
import sys
from controllers.drone_controller import DroneController

def main():
    parser = argparse.ArgumentParser(description='Control HelpNet Drone')
    parser.add_argument('--name', default='Drone1', help='Drone name')
    parser.add_argument('--takeoff', action='store_true', help='Take off')
    parser.add_argument('--land', action='store_true', help='Land')
    parser.add_argument('--goto', nargs=2, metavar=('LAT', 'LON'), help='Navigate to GPS coordinates')
    parser.add_argument('--orbit', action='store_true', help='Start surveillance orbit')
    
    args = parser.parse_args()
    
    drone = DroneController(args.name)
    
    if args.takeoff:
        drone.takeoff()
    elif args.land:
        drone.land()
    elif args.goto:
        lat, lon = map(float, args.goto)
        drone.navigate_to(lat, lon)
    elif args.orbit:
        telemetry = drone.get_telemetry()
        x, y = drone._gps_to_ned(telemetry['latitude'], telemetry['longitude'])
        drone.orbit_target(x, y)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()