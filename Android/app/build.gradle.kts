plugins {
    alias(libs.plugins.android.application)
}

// One version for the whole project: the VERSION file at the repository root.
val projectVersion = rootProject.file("../VERSION").readText().trim()
val versionParts = projectVersion.split(".").map { it.toInt() }
val androidVersionCode = versionParts[0] * 10_000 + versionParts[1] * 100 + versionParts[2]

android {
    namespace = "com.example.inspectorblanque_android"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.example.inspectorblanque_android"
        minSdk = 24
        targetSdk = 37
        versionCode = androidVersionCode
        versionName = projectVersion

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    sourceSets {
        getByName("main") {
            assets.srcDir("build/generated/web-assets")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Builds the web app (../web) into one self-contained HTML file and bundles it as the app's index.html.
// Skip with -PskipWebBuild to reuse an existing build in ../web/dist.
val buildWeb by tasks.registering(Exec::class) {
    workingDir = rootProject.file("../web")
    commandLine("bash", "./scripts/build_release.sh")
    onlyIf { !project.hasProperty("skipWebBuild") }
}

val copyWeb by tasks.registering(Copy::class) {
    dependsOn(buildWeb)
    from(fileTree(rootProject.file("../web/dist")) { include("Inspector_Blanque_v*_single_file.html") }) { rename { "index.html" } }
    into(layout.buildDirectory.dir("generated/web-assets"))
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.webkit)
    implementation(libs.material)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
