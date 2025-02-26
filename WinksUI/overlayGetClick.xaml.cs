using System;
using System.Windows;
using System.Windows.Input;

namespace WinksUI
{
    public partial class overlayGetClick : Window
    {
        // Declare an event to send the cursor position back
        public event Action<Point> CursorPositionReturned;

        public overlayGetClick()
        {
            InitializeComponent();

            // Set the window to cover the entire screen
            this.Width = SystemParameters.PrimaryScreenWidth;
            this.Height = SystemParameters.PrimaryScreenHeight;
            this.Left = 0;
            this.Top = 0;
        }

        private void OverlayWindow_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            // Get the cursor position when clicked
            Point cursorPosition = Mouse.GetPosition(this);

            // Raise the event to send the position back to AssistMenu.xaml.cs
            CursorPositionReturned?.Invoke(cursorPosition);

            // Close the overlay
            this.Close();
        }
    }
}
