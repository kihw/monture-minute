package expo.modules.installateurapk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * Statut d'une session d'installation. Si Android exige une confirmation (Android 8 à 11, ou
 * conditions de mise à jour silencieuse non remplies), on ouvre sa fenêtre : un seul geste.
 */
class RecepteurInstallation : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val statut = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    when (statut) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        val confirmation =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
          } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_INTENT)
          }
        confirmation?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)?.let(context::startActivity)
        emettre("confirmation", statut, message)
      }
      PackageInstaller.STATUS_SUCCESS -> emettre("succes", statut, message)
      // Refus de l'utilisateur, conflit de signature, espace insuffisant…
      else -> emettre("echec", statut, message)
    }
  }

  private fun emettre(etat: String, code: Int, message: String?) {
    InstallateurApkModule.instance?.emettre(mapOf("etat" to etat, "code" to code, "message" to message))
  }

  companion object {
    const val ACTION = "expo.modules.installateurapk.STATUT_INSTALLATION"
  }
}
