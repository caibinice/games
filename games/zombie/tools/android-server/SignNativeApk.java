import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** The signing password is read from the environment, never command arguments. */
public final class SignNativeApk {
  public static void main(String[] args) throws Exception {
    if (args.length != 3) throw new IllegalArgumentException("input.apk output.apk signing.p12");
    String value = System.getenv("NATIVE_APK_STORE_PASSWORD");
    if (value == null || value.length() < 16) throw new IllegalArgumentException("Signing environment missing");
    char[] password = value.toCharArray();
    KeyStore store = KeyStore.getInstance("PKCS12");
    try (FileInputStream in = new FileInputStream(args[2])) { store.load(in, password); }
    PrivateKey key = (PrivateKey)store.getKey("native-game", password);
    X509Certificate cert = (X509Certificate)store.getCertificate("native-game");
    ApkSigner.SignerConfig config = new ApkSigner.SignerConfig.Builder("native-game", key, Collections.singletonList(cert)).build();
    new ApkSigner.Builder(Collections.singletonList(config)).setInputApk(new File(args[0])).setOutputApk(new File(args[1]))
      .setMinSdkVersion(21).setV1SigningEnabled(true).setV2SigningEnabled(true).setV3SigningEnabled(true).build().sign();
    ApkVerifier.Result result = new ApkVerifier.Builder(new File(args[1])).build().verify();
    if (!result.isVerified() || !result.isVerifiedUsingV2Scheme()) throw new IllegalStateException("APK signature verification failed: " + result.getErrors());
    System.out.println("APK signature verified; v1="+result.isVerifiedUsingV1Scheme()+" v2="+result.isVerifiedUsingV2Scheme()+" v3="+result.isVerifiedUsingV3Scheme());
  }
}
