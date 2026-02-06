#!/usr/bin/env python3
"""
Test script for Y.js server health check
"""
import asyncio
import socket

async def test_health_check():
    """Test the health check functionality"""
    try:
        # Create a socket connection to port 8002
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('localhost', 8002))

        # Send a GET /health request
        request = b"GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n"
        sock.send(request)

        # Receive response
        response = sock.recv(1024)
        response_str = response.decode()

        print("Health check response:")
        print(response_str)

        # Check if it contains the expected JSON
        if '{"status": "healthy", "service": "yjs-websocket"}' in response_str:
            print("✅ Health check PASSED")
            return True
        else:
            print("❌ Health check FAILED")
            return False

    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    finally:
        sock.close()

async def main():
    print("Testing Y.js server health check...")

    # Start the server in the background
    import subprocess
    import time

    print("Starting Y.js server...")
    server_process = subprocess.Popen(['python3', 'yjs_server.py'],
                                    cwd='/Volumes/Amitesh/System Design/CodeSync_AI/codesync',
                                    stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE)

    # Wait a moment for server to start
    time.sleep(3)

    try:
        # Test health check
        result = await test_health_check()

        if result:
            print("\n🎉 Health check test PASSED! The server is ready for Render deployment.")
        else:
            print("\n❌ Health check test FAILED!")

    finally:
        # Stop the server
        server_process.terminate()
        server_process.wait()

if __name__ == '__main__':
    asyncio.run(main())
