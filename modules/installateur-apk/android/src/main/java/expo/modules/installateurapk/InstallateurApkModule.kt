package expo.modules.installateurapk

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * Mise à jour de Monture Minute par son propre APK (docs/PLAN-MAJ.md, § 6.2) : vérifications
 * (empreinte, certificat) et installation par une session PackageInstaller. Sur Android 12+,
 * une app qui se met à jour elle-même s'installe sans confirmation ; sinon Android la demande.
 */
class InstallateurApkModule : Module() {
  private val contexte: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("InstallateurApk")

    Events("onStatut")

    OnCreate {
      instance = this@InstallateurApkModule
      // L'app est rouverte : la notification « touche pour rouvrir » n'a plus lieu d'être.
      appContext.reactContext?.getSystemService(NotificationManager::class.java)?.cancel(RecepteurMiseAJour.ID_NOTIFICATION)
    }

    OnDestroy {
      if (instance === this@InstallateurApkModule) instance = null
    }

    /** L'app a le droit d'installer des APK (« Installer des applications inconnues »). */
    Function("peutInstaller") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O || contexte.packageManager.canRequestPackageInstalls()
    }

    /** Android 12+ : la mise à jour peut se faire sans confirmation. */
    Function("installationSilencieuse") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    }

    /** Ouvre le réglage « Installer des applications inconnues » de l'app. */
    Function("ouvrirAutorisation") {
      val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${contexte.packageName}"))
        } else {
          Intent(Settings.ACTION_SECURITY_SETTINGS)
        }
      contexte.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** sha256 du fichier, en hexadécimal (fait ici : l'APK pèse plusieurs dizaines de Mo). */
    AsyncFunction("empreinteAsync") { chemin: String ->
      val condense = MessageDigest.getInstance("SHA-256")
      FileInputStream(fichier(chemin)).use { flux ->
        val tampon = ByteArray(1 shl 16)
        while (true) {
          val lus = flux.read(tampon)
          if (lus < 0) break
          condense.update(tampon, 0, lus)
        }
      }
      hex(condense.digest())
    }

    /**
     * Certificat de signature (sha256) de l'APK téléchargé et de l'app installée : Android refuse une
     * mise à jour signée par une autre clé, on le vérifie avant de lancer l'installation.
     */
    AsyncFunction("certificatsAsync") { chemin: String ->
      val pm = contexte.packageManager
      val apk = pm.getPackageArchiveInfo(fichier(chemin).absolutePath, drapeauxSignature())
      val installee = pm.getPackageInfo(contexte.packageName, drapeauxSignature())
      mapOf(
        "apk" to apk?.let { certificat(it) },
        "installee" to certificat(installee),
        "paquet" to apk?.packageName,
        "versionCode" to apk?.let { versionCode(it) },
      )
    }

    /**
     * Installe l'APK par une session PackageInstaller. Le résultat arrive par l'événement onStatut :
     * « confirmation » (Android ouvre sa fenêtre), « echec » ; en cas de succès, Android ferme l'app.
     */
    AsyncFunction("installerAsync") { chemin: String ->
      val apk = fichier(chemin)
      val installeur = contexte.packageManager.packageInstaller
      val parametres = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
        setAppPackageName(contexte.packageName)
        setSize(apk.length())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          setPackageSource(PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE)
        }
      }
      val id = installeur.createSession(parametres)
      installeur.openSession(id).use { session ->
        session.openWrite("base.apk", 0, apk.length()).use { sortie ->
          FileInputStream(apk).use { it.copyTo(sortie, 1 shl 16) }
          session.fsync(sortie)
        }
        val retour = Intent(contexte, RecepteurInstallation::class.java).setAction(RecepteurInstallation.ACTION)
        // Mutable : le système ajoute le statut à l'intent.
        val drapeaux =
          PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
        session.commit(PendingIntent.getBroadcast(contexte, id, retour, drapeaux).intentSender)
      }
      id
    }
  }

  /** Relaie un statut de session reçu par RecepteurInstallation. */
  internal fun emettre(statut: Map<String, Any?>) {
    sendEvent("onStatut", statut)
  }

  private fun fichier(chemin: String): File {
    val f = if (chemin.startsWith("file://")) File(Uri.parse(chemin).path!!) else File(chemin)
    if (!f.isFile) throw IllegalArgumentException("Fichier introuvable : $chemin")
    return f
  }

  companion object {
    internal var instance: InstallateurApkModule? = null

    @Suppress("DEPRECATION")
    private fun drapeauxSignature(): Int =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES

    @Suppress("DEPRECATION")
    private fun certificat(info: PackageInfo): String? {
      val signatures =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          info.signingInfo?.let { if (it.hasMultipleSigners()) it.apkContentsSigners else it.signingCertificateHistory }
        } else {
          info.signatures
        }
      val premiere = signatures?.firstOrNull() ?: return null
      return hex(MessageDigest.getInstance("SHA-256").digest(premiere.toByteArray()))
    }

    @Suppress("DEPRECATION")
    private fun versionCode(info: PackageInfo): Long =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

    private fun hex(octets: ByteArray): String = octets.joinToString("") { "%02x".format(it) }
  }
}
