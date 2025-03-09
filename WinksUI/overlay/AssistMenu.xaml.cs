using RadialMenu.Controls;
using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace WinksUI
{

    public partial class AssistMenu : Window, INotifyPropertyChanged
    {
        // Constants for scrolling
        private const uint MOUSEEVENTF_WHEEL = 0x0800;
        private const int WHEEL_DELTA = 120;
        private const int KEYEVENTF_KEYUP = 0x0002;
        private const int VK_SHIFT = 0x10;  // Virtual key code for SHIFT key

        // Import necessary functions from user32.dll
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        static extern bool GetCursorPos(out POINT lpPoint);
        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }
        //Start scrolling logic
        private POINT initialCursorPosition;
        private POINT desiredLocation; // Variable to store the desired location
        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            // Get the desktop's working area (excluding taskbars)
            var desktopWorkingArea = System.Windows.SystemParameters.WorkArea;

            // Position the window at the bottom-left corner
            this.Left = desktopWorkingArea.Left;
            this.Top = desktopWorkingArea.Bottom - this.Height;

            desiredLocation.X = (int)(desktopWorkingArea.Left + desktopWorkingArea.Width / 2);
            desiredLocation.Y = (int)(desktopWorkingArea.Top + desktopWorkingArea.Height / 2);
        }

        private async void UpButton_Click()
        {
            await TeleportCursorAndScrollAsync(3, 0); // Scroll up by 3 lines
        }

        private async void DownButton_Click()
        {
            await TeleportCursorAndScrollAsync(-3, 0); // Scroll down by 3 lines
        }
        private async void RightButton_Click()
        {
            await TeleportCursorAndScrollAsync(0, -3); // Scroll up by 3 lines
        }

        private async void LeftButton_Click()
        {
            await TeleportCursorAndScrollAsync(0, 3); // Scroll down by 3 lines
        }

        private async Task TeleportCursorAndScrollAsync(int verticalScrollAmount, int horizontalScrollAmount)
        {
            // Get the current cursor position
            GetCursorPos(out initialCursorPosition);

            // Use the user's desired location instead of the screen center
            SetCursorPos(desiredLocation.X, desiredLocation.Y); // Teleport cursor to the user's desired location

            // Simulate scrolling under the cursor
            SimulateScroll(verticalScrollAmount, horizontalScrollAmount);

            // Teleport the cursor back to the original position
            SetCursorPos(initialCursorPosition.X, initialCursorPosition.Y);
        }

        // Simulate scrolling under the cursor
        private void SimulateScroll(int verticalScrollAmount, int horizontalScrollAmount)
        {
            if (verticalScrollAmount != 0)
            {
                // The scroll amount (WHEEL_DELTA is 120 for a single tick of the wheel)
                int scrollValue = verticalScrollAmount * WHEEL_DELTA;

                // Simulate the mouse wheel event
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, scrollValue, UIntPtr.Zero);
            }
            else if(horizontalScrollAmount != 0)
            {
                // The scroll amount (WHEEL_DELTA is 120 for a single tick of the wheel)
                int scrollValue = horizontalScrollAmount * WHEEL_DELTA;

                // Simulate the mouse wheel event
                keybd_event(VK_SHIFT, 0x45, 0, IntPtr.Zero);
                mouse_event(MOUSEEVENTF_WHEEL, 0, 0, scrollValue, UIntPtr.Zero);
                keybd_event(VK_SHIFT, 0x45, KEYEVENTF_KEYUP, IntPtr.Zero);
            }
        }

        private void ChangeScrollingLocation()
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
        //End scrolling logic

        //handling radial menu visability
        private bool _isOpen = false;
        public bool IsOpen
        {
            get
            {
                return _isOpen;
            }
            set
            {
                _isOpen = value;
                RaisePropertyChanged();
            }
        }

        public AssistMenu()
        {
            InitializeComponent();
            DataContext = this;

            //Collapsed menu
            var CollapsedCentralItem = new RadialMenuCentralItem
            {
                Content = new TextBlock { Text = "Open", Foreground = Brushes.White },
                Background = Brushes.Black
            };

            //Main radial menu
            var MainMenuCentralItem = new RadialMenuCentralItem
            {
                Content = new TextBlock { Text = "Collapse", Foreground = Brushes.White },
                Background = Brushes.Black
            };
            var MainMenuItems = new List<RadialMenuItem>
            {
                new RadialMenuItem
                {
                    Content = new TextBlock { Text = "Scroll", Foreground = Brushes.White},
                    ArrowBackground = Brushes.Transparent
                },
                new RadialMenuItem
                {
                    Content = new TextBlock { Text = "Drag", Foreground = Brushes.White },
                    ArrowBackground = Brushes.Transparent

                },
                new RadialMenuItem
                {
                    Content = new TextBlock { Text = "Move Menu", Foreground = Brushes.White },
                    ArrowBackground = Brushes.Transparent

                },
                new RadialMenuItem
                {
                    Content = new TextBlock { Text = "Keyboard", Foreground = Brushes.White },
                    ArrowBackground = Brushes.Transparent
                }
            };

            //scrolling menu
            var ScrollMenuCentralItem = new RadialMenuCentralItem
            {
                Content = new TextBlock { Text = "⋮", Foreground = Brushes.White },
                FontSize = 30,
                Background = Brushes.Black
            };
            var ScrollMenuItems = new List<RadialMenuItem>
            {
                //up
                new RadialMenuItem
                {
                    EdgeInnerRadius = 100,
                    ArrowHeight = 50,
                    ArrowWidth = 50,
                    ArrowRadius = 125

                },
                //right
                new RadialMenuItem
                {
                    EdgeInnerRadius = 100,
                    ArrowHeight = 50,
                    ArrowWidth = 50,
                    ArrowRadius = 125

                },
                //down
                new RadialMenuItem
                {
                    EdgeInnerRadius = 100,
                    ArrowHeight = 50,
                    ArrowWidth = 50,
                    ArrowRadius = 125
                },
                //left
                new RadialMenuItem
                {
                    EdgeInnerRadius = 100,
                    ArrowHeight = 50,
                    ArrowWidth = 50,
                    ArrowRadius = 125
                }
            };

            var ScrollSubMenuCentralItem = new RadialMenuCentralItem
            {
                Content = new TextBlock { Text = "Go Back", Foreground = Brushes.White },
                Background = Brushes.Black
            };
            var ScrollSubMenu = new List<RadialMenuItem>
            {
                new RadialMenuItem
                {
                    Content = new TextBlock
                    {
                        Text = "Change Scroll Location",
                        Foreground = Brushes.White,
                        Width = 75, 
                        TextWrapping = TextWrapping.Wrap, 
                        TextAlignment = TextAlignment.Center 
                    },
                    ArrowBackground = Brushes.Transparent,

                },
                new RadialMenuItem
                {
                    Content = new TextBlock{ Text = "Exit Scroll", Foreground = Brushes.White},
                    ArrowBackground = Brushes.Transparent,

                },
            };

            //functions to open different radial menus:
            //collapse menu
            async void collapseMenu()
            {
                IsOpen = false;
                await Task.Delay(400);
                MyRadialMenu.CentralItem = CollapsedCentralItem;
                MyRadialMenu.Items = new List<RadialMenuItem> { };
                IsOpen = true;
            }
            //Open main menu
            async void loadMainMenu()
            {
                IsOpen = false;
                await Task.Delay(400);
                MyRadialMenu.Items = MainMenuItems;
                MyRadialMenu.CentralItem = MainMenuCentralItem;
                IsOpen = true;
            }
            //Open Scroll Menu
            async void loadScrollMenu() 
            {
                IsOpen = false;
                await Task.Delay(400);
                MyRadialMenu.HalfShiftedItems = true;
                MyRadialMenu.Items = ScrollMenuItems;
                MyRadialMenu.CentralItem = ScrollMenuCentralItem;
                IsOpen = true;
            }

            //Open main menu
            CollapsedCentralItem.Click += async (sendar, args) =>
            {
                loadMainMenu();
            };

            //Start Main menu clickables:
            //clicked collapse
            MainMenuCentralItem.Click += async (sender, args) =>
            {
                collapseMenu();
            };

            //clicked on scroll
            MainMenuItems[0].Click += async (sender, args) =>
            {
                loadScrollMenu();
            };

            //End Main menu Clickables

            //Start Scroll menu Clickables:
            //up
            ScrollMenuItems[0].Click += async (sender, args) =>
            {
                UpButton_Click();
            };
            ScrollMenuItems[1].Click += async (sender, args) =>
            {
                RightButton_Click();
            };
            //down
            ScrollMenuItems[2].Click += async (sender, args) =>
            {
                DownButton_Click();
            };
            ScrollMenuItems[3].Click += async (sender, args) =>
            {
                LeftButton_Click();
            };

            //Clicked on more options
            ScrollMenuCentralItem.Click += async (sender, args) =>
            {
                IsOpen = false;
                await Task.Delay(400);
                MyRadialMenu.Items = ScrollSubMenu;
                MyRadialMenu.CentralItem = ScrollSubMenuCentralItem;
                MyRadialMenu.HalfShiftedItems = false;
                IsOpen = true;

            };

            //Clicked on go back to scroll
            ScrollSubMenuCentralItem.Click += async (sender, args) =>
            {
                loadScrollMenu();
            };
            //Clicked on exit scroll
            ScrollSubMenu[1].Click += async (sender, args) =>
            {
                loadMainMenu();
            };
            //Clicked on change scroll location
            ScrollSubMenu[0].Click += async (sender, args) =>
            {
                ChangeScrollingLocation();
                loadScrollMenu();
            };
            //End Scroll menu clickables

            //Set default menu to collapsed
            collapseMenu();

            //make window translucent
            this.Opacity = .75;
        }
        
        public event PropertyChangedEventHandler? PropertyChanged;
        void RaisePropertyChanged([CallerMemberName] string propertyName = null)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(propertyName));
            }
        }

    }
}
