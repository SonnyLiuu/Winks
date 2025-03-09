using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace WinksUI;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private AssistMenu assistMenu;
    public MainWindow()
    {
        InitializeComponent();
        assistMenu = new AssistMenu();

    }

    private void Button_Click(object sender, RoutedEventArgs e)
    {
        if (DisplayAssistButton.IsChecked == true)
        {
            assistMenu.Show();
            assistMenu.IsOpen = true;
        }
        else if (HideAssistButton.IsChecked == true)
        {
            assistMenu.IsOpen = false;
        }
    }

    private void HelloButton_Checked(object sender, RoutedEventArgs e)
    {

    }
}