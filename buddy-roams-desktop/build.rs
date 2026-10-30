use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=assets/pet");

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR");
    let dest = Path::new(&out_dir).join("generated_assets.rs");

    let mut code = String::from(
        "pub static ASSETS: &[(&str, &[u8])] = &[\n",
    );

    let mut add_dir = |dir: &str| {
        let mut files: Vec<_> = fs::read_dir(dir)
            .expect("read assets dir")
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map(|e| e == "png").unwrap_or(false))
            .collect();
        files.sort();
        for f in files {
            let name = f.file_name().unwrap().to_str().unwrap().to_string();
            let rel = format!("{}/{}", dir, name);
            code.push_str(&format!(
                "    (\"{}\", include_bytes!(concat!(env!(\"CARGO_MANIFEST_DIR\"), \"/{}\"))),\n",
                name, rel
            ));
        }
    };

    add_dir("assets/pet");
    add_dir("assets/pet/accessories");
    code.push_str("];\n");

    fs::write(dest, code).expect("write generated assets");
}
