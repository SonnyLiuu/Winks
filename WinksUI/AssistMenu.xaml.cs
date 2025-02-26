using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;

namespace WinksUI
{
    public partial class AssistMenu : Window
    {
        // Constants for scrolling
        private const uint MOUSEEVENTF_WHEEL = 0x0800;
        private const int WHEEL_DELTA = 120;

        // Import necessary functions from user32.dll
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        static extern bool GetCursorPos(out POINT lpPoint);

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        private POINT initialCursorPosition;
        private POINT desiredLocation; // Variable to store the desired location

        public AssistMenu()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            // Get the desktop's working area (excluding taskbars)
            var desktopWorkingArea = System.Windows.SystemParameters.WorkArea;

            // Position the window at the bottom-left corner
            this.Left = desktopWorkingArea.Left;
            this.Top = desktopWorkingArea.Bottom - this.Height;
        }

        private async void UpButton_Click(object sender, RoutedEventArgs e)
        {
            await TeleportCursorAndScrollAsync(3); // Scroll up by 3 lines
        }

        private async void DownButton_Click(object sender, RoutedEventArgs e)
        {
            await TeleportCursorAndScrollAsync(-3); // Scroll down by 3 lines
        }

        private async Task TeleportCursorAndScrollAsync(int scrollAmount)
        {
            // Get the current cursor position
            GetCursorPos(out initialCursorPosition);

            // Use the user's desired location instead of the screen center
            SetCursorPos(desiredLocation.X, desiredLocation.Y); // Teleport cursor to the user's desired location

            // Simulate scrolling under the cursor
            SimulateScroll(scrollAmount);

            // Teleport the cursor back to the original position
            SetCursorPos(initialCursorPosition.X, initialCursorPosition.Y);
        }

        // Simulate scrolling under the cursor
        private void SimulateScroll(int scrollAmount)
        {
            // The scroll amount (WHEEL_DELTA is 120 for a single tick of the wheel)
            int scrollValue = scrollAmount * WHEEL_DELTA;

            // Simulate the mouse wheel event
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, scrollValue, UIntPtr.Zero);
        }

        private void BlueButton_Click(object sender, RoutedEventArgs e)
        {
            // Create and show the transparent grey overlay
            overlayGetClick overlay = new overlayGetClick();

            // Subscribe to the event to get the cursor position when the overlay is clicked
            overlay.CursorPositionReturned += (cursorPosition) =>
            {
                // Convert System.Windows.Point to WinksUI.AssistMenu.POINT
                desiredLocation = new POINT
                {
                    X = (int)cursorPosition.X,
                    Y = (int)cursorPosition.Y
                };
            };

            overlay.Show();
        }
    }
}
