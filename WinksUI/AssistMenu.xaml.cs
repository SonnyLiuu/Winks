using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;

namespace WinksUI
{
    public partial class AssistMenu : Window
    {
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const int GWL_EXSTYLE = -20;

        // Import user32.dll to simulate key presses
        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        private const int KEYEVENTF_KEYDOWN = 0x0000; // Key down flag
        private const int KEYEVENTF_KEYUP = 0x0002;   // Key up flag

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hwnd, int index);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

        public AssistMenu()
        {
            InitializeComponent();
        }

        // Override OnSourceInitialized to prevent the window from taking focus when clicked
        protected override void OnSourceInitialized(EventArgs e)
        {
            var hwnd = new WindowInteropHelper(this).Handle;
            int style = GetWindowLong(hwnd, GWL_EXSTYLE);
            SetWindowLong(hwnd, GWL_EXSTYLE, style | WS_EX_NOACTIVATE);

            base.OnSourceInitialized(e);
        }

        // Simulate pressing the "Up Arrow" key when the UpButton is clicked
        private void UpButton_Click(object sender, RoutedEventArgs e)
        {
            SimulateKeyPress(Key.Up);
        }

        // Simulate pressing the "Down Arrow" key when the DownButton is clicked
        private void DownButton_Click(object sender, RoutedEventArgs e)
        {
            SimulateKeyPress(Key.Down);
        }

        // Simulate key press using keybd_event API
        private void SimulateKeyPress(Key key)
        {
            byte virtualKeyCode = (byte)KeyInterop.VirtualKeyFromKey(key);

            // Simulate key down
            keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYDOWN, 0);

            // Simulate key up
            keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYUP, 0);
        }
    }
}
