const express = require('express');
const router = express.Router();
const Product = require("../../models/product");
const Coupon = require("../../models/coupon");
const Brand = require("../../models/brand");
const Color = require("../../models/subCategory/color");
const imageMimeTypes = ['image/jpeg', 'image/png', 'images/gif'];
const bodyParser = require('body-parser');
router.use(bodyParser.urlencoded({ extended: true }));

// Render the main product page with filters and pagination
router.get('/', async (req, res, next) => {
  try {
    const selectedColor = req.query.color;
    const selectedBrand = req.query.brand;
    
    // Define the query based on selected color and brand
    const query = {};
    if (selectedColor) {
      query.color = selectedColor;
    }
    if (selectedBrand) {
      query.brand = selectedBrand;
    }

    const perPage = 6;
    const currentPage = req.query.page || 1;
    const skip = (currentPage - 1) * perPage;

    // Fetch products with pagination and populate the 'brand' field
    const products = await Product.find(query)
      .skip(skip)
      .limit(perPage)
      .populate('brand');

    const colors = await Color.find();
    const brands = await Brand.find();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    res.render("admin/product-control/indextest.ejs", {
      layout: false,
      indexUrl: req.session.indexUrl,
      products,
      selectedColor,
      selectedBrand,
      colors,
      brands,
      currentPage,
      totalPages,
    });
  } catch (error) {
    res.redirect('/admin');
  }
});

// Render the 'add' page for products
router.get('/add', async (req, res) => {
  const brands = await Brand.find();
  res.render('admin/product-control/add/add.ejs', { 
    indexUrl: req.session.indexUrl,
    layout: false,
    brand: new Brand(),
    color: new Color(),
    brands,
    errorMessage: req.session.brandError || ''
  });
});








// Render the 'inventory' page
router.get('/inventory', (req, res) => {
  res.render('admin/product-control/inventory.ejs', { layout: false });
});


// Handle POST request to create a new brand
router.post('/brand', async (req, res) => {
  const brand = new Brand({
    name: req.body.name
  });

  try {

    const viewBrands = await Brand.find();
    const newBrand = await brand.save();
    res.redirect('/admin/product-control');
  } catch {
    req.session.brandError = 'Error: That name is already added.'
    res.redirect('/admin/product-control/add')
  }
});

// Handle POST request to create a new color
router.post('/color', async (req, res) => {
  const color = new Color({
    name: req.body.name
  });

  try {
    const newColor = await color.save();
    res.redirect('/admin/product-control');
  } catch {
    req.session.brandError = 'Error: That name is already added.'
    res.redirect('/admin/product-control/add')
  }
});


// Render the 'new' page for adding a new product
router.get('/new', async (req, res) => {
  renderNewPage(res, new Product());
});

// Handle POST request to create a new product
router.post('/', async (req, res) => {
  const product = new Product({
    name: req.body.name,
    description: req.body.description,
    gender: req.body.gender,
    category: req.body.category,
    subCategory: req.body.subCategory,
    brand: req.body.brand,
    color: req.body.color,
    price: req.body.price,
    discount: req.body.discount,
    totalStock: req.body.totalStock,
  });

  saveSizes(product, req.body.sizes, req.body.stock);

  const coverArray = req.body.cover;

  if (!coverArray || coverArray.length === 0) {
    return renderNewPage(res, product, true, "At least one cover image is required.");
  }

  const maxCoverCount = 4;
  const coverCount = Math.min(coverArray.length, maxCoverCount);
  req.body.cover = coverArray.slice(0, coverCount);

  saveCovers(product, req.body.cover);

  try {
    const newProduct = await product.save();
    res.redirect(`/admin/product-control/${newProduct.id}`);
  } catch (error) {
    console.error("Error saving product:", error);
    renderNewPage(res, product, true);
  }
});


// Show product Route
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('brand')
      .populate('color')
      .exec();
    res.render('admin/product-control/view.ejs', {
      indexUrl: req.session.indexUrl,
      product,
    });
  } catch {
    res.redirect('/');
  }
});

// Edit product Route
router.get('/:id/edit', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    renderEditPage(res, product);
  } catch {
    res.redirect('/');
  }
});

// Update product Route
router.put('/:id', async (req, res) => {
  let product;

  try {
    product = await Product.findById(req.params.id);
    product.name = req.body.name;
    product.description = req.body.description;
    product.gender = req.body.gender;
    product.category = req.body.category;
    product.subCategory = req.body.subCategory;
    product.brand = req.body.brand;
    product.color = req.body.color;
    product.price = req.body.price;
    product.discount = req.body.discount;
    product.totalStock = req.body.totalStock;
    if (req.body.cover != null && req.body.cover !== '') {
      saveCovers(product, req.body.cover);
      saveSizes(product, req.body.sizes, req.body.stock);
    }
    await product.save();
    res.redirect(`/admin/product-control/${product.id}`);
  } catch {
    if (product != null) {
      renderEditPage(res, product, true);
    } else {
      res.redirect('/');
    }
  }
});

// Delete product Page
router.delete('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    await Product.findByIdAndRemove(productId);
    res.redirect('/admin/product-control');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/product-control');
  }
});

async function renderNewPage(res, product, hasError = false) {
  renderFormPage(res, product, 'new', hasError);
}

async function renderEditPage(res, product, hasError = false) {
  renderFormPage(res, product, 'edit', hasError);
}

async function renderFormPage(res, product, form, hasError = false) {
  const predefinedSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  try {
    const brands = await Brand.find({});
    const colors = await Color.find({});
    let params;
    if (form === 'edit') {
       params = {
        brands,
        colors,
        product,
        sizes: predefinedSizes,
      };
    } else {
       params = {
        layout: false,
        brands,
        colors,
        product,
        sizes: predefinedSizes,
      };
    }
   
    if (hasError) {
      if (form === 'edit') {
        params.errorMessage = 'Error Updating product';
      } else {
        params.errorMessage = 'Error Creating product';
      }
    }
    res.render(`admin/product-control/${form}`, params);
  } catch (e) {
    console.log(e);
    res.redirect('/products');
  }
}


function saveCovers(product, coverEncodedArray) {
  if (!Array.isArray(coverEncodedArray)) {
    return;
  }

  const coverImages = [];

  for (const coverEncoded of coverEncodedArray) {
    try {
      const cover = JSON.parse(coverEncoded);

      if (cover != null && imageMimeTypes.includes(cover.type)) {
        const imageBuffer = Buffer.from(cover.data, 'base64');
        const imageType = cover.type;
        coverImages.push({ image: imageBuffer, imageType });
      }
    } catch (error) {
      console.error("Error parsing cover image:", error);
    }
  }

  if (coverImages.length > 0) {
    product.coverImages = coverImages;
  }
}


module.exports = router;
