using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

class Program {
    [STAThread]
    static void Main(string[] args) {
        try {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string launcherPath = Path.Combine(baseDir, "bin", "launcher.exe");

            if (!File.Exists(launcherPath)) {
                launcherPath = Path.Combine(baseDir, "SafeVaultPro-dev", "bin", "launcher.exe");
            }

            if (File.Exists(launcherPath)) {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = launcherPath;
                psi.WorkingDirectory = Path.GetDirectoryName(launcherPath);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                if (args.Length > 0) {
                    psi.Arguments = string.Join(" ", args);
                }

                Process.Start(psi);
            } else {
                MessageBox.Show(
                    "Could not locate application binary at: " + launcherPath,
                    "SafeVaultPro Launch Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        } catch (Exception ex) {
            MessageBox.Show(
                "Failed to launch SafeVaultPro: " + ex.Message,
                "SafeVaultPro Launch Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}
