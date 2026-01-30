from playwright.sync_api import sync_playwright

def verify_mobile_settings():
    with sync_playwright() as p:
        # Simulate iPhone 12 Pro
        iphone_12 = p.devices['iPhone 12 Pro']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_12)
        page = context.new_page()

        print("Navigating to settings-test...")
        try:
            page.goto("http://localhost:3001/settings-test", timeout=30000)
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Navigation failed: {e}")
            browser.close()
            return

        print("Checking for mobile header...")
        # Check for "Cài Đặt" text which is in the mobile header
        # The exact text in the component is "Cài Đặt" inside a span
        header_title = page.locator("text=Cài Đặt")
        if header_title.first.is_visible():
            print("Mobile header title found.")
        else:
            print("Mobile header title NOT found.")

        # Check for tabs (e.g., "Thông tin công ty")
        print("Checking for tabs...")
        tab = page.get_by_role("button", name="Thông tin công ty")
        if tab.first.is_visible():
            print("Tab 'Thông tin công ty' is visible.")
        else:
            print("Tab 'Thông tin công ty' is NOT visible.")

        # Take screenshot
        screenshot_path = "verification/mobile_settings.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_mobile_settings()
